const bcrypt = require("bcryptjs");
const pool = require("../../config/db");
const userModel = require("./user.model");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");
const { getPagination, getPaginationMeta } = require("../../utils/paginationHelper");

function isActorAdmin(actor) {
  const name = String(actor.role_name || "").toLowerCase();
  return name === "admin" || actor.role_level === 0;
}

async function createUser({ actorId, name, email, mobile, state, city, password, roleId, parentId: requestedParentId }) {
  if (!actorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required to create a user", [], "UNAUTHORIZED");
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Authenticate requester and fetch creator context
    const actor = await userModel.findUserForAuth(actorId, connection);
    if (!actor) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Active authenticated creator not found", [], "UNAUTHORIZED");
    }

    // 2. Validate and resolve target child role
    const targetRole = await userModel.findRoleByIdOrName(roleId, connection);
    if (!targetRole) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Requested role does not exist", [], "INVALID_ROLE");
    }

    // 3. Verify permitted parent-child relationship using role hierarchy (child.level > parent.level)
    const isPermitted = targetRole.level > actor.role_level;

    if (!isPermitted) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        `Role '${actor.role_name}' is not authorized to create a '${targetRole.name}'`,
        [],
        "FORBIDDEN"
      );
    }

    // 4. Check whether email or mobile already exists
    const duplicate = await userModel.checkDuplicateUser(
      { email, mobile },
      connection
    );

    if (duplicate) {
      const field = duplicate.email === email ? "Email" : "Mobile number";
      throw new ApiError(httpStatus.CONFLICT, `${field} already exists`, [], "DUPLICATE_ENTRY");
    }

    // 5. Hash password before storing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Parent ID defaults to creator, or validated downline parent if provided
    let parentId = actor.id;
    if (requestedParentId && requestedParentId !== actor.id) {
      const isAllowedParent = await userModel.isInDownline(actor.id, requestedParentId, isActorAdmin(actor), connection);
      if (!isAllowedParent) {
        throw new ApiError(httpStatus.BAD_REQUEST, "Specified parent is not within your downline hierarchy", [], "INVALID_PARENT_ID");
      }
      parentId = requestedParentId;
    }
    const companyId = actor.company_id || null;

    // 7. Insert the user using the approved MySQL schema
    const newUserId = await userModel.insertUser(
      {
        name,
        email,
        mobile,
        state: state || null,
        city: city || null,
        passwordHash,
        roleId: targetRole.id,
        companyId,
        parentId,
        createdBy: actor.id,
        status: "active"
      },
      connection
    );

    // 8. Fetch the created user without password or password_hash
    const newUser = await userModel.findUserSafeById(newUserId, connection);

    // 9. Commit transaction
    await connection.commit();

    return newUser;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Preserve the original error if rollback also fails.
    }

    throw error;
  } finally {
    connection.release();
  }
}

async function listUsers(actorId, query = {}) {
  const actor = await userModel.findUserForAuth(actorId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  const { page, limit, offset } = getPagination(query);
  const isAdmin = isActorAdmin(actor);

  let targetRoleId = null;
  if (query.role) {
    const roleObj = await userModel.findRoleByIdOrName(query.role);
    targetRoleId = roleObj ? roleObj.id : null;
  }

  const { rows, total } = await userModel.listUsersDownline({
    actorId: actor.id,
    isAdmin,
    scope: query.scope,
    roleId: targetRoleId,
    status: query.status,
    search: query.search,
    limit,
    offset
  });

  const pagination = getPaginationMeta({ page, limit, total });

  return {
    users: rows,
    pagination
  };
}

async function getUser(actorId, targetUserId) {
  const actor = await userModel.findUserForAuth(actorId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  const isAdmin = isActorAdmin(actor);
  const allowed = await userModel.isInDownline(actor.id, targetUserId, isAdmin);
  if (!allowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found", [], "NOT_FOUND");
  }

  const user = await userModel.findUserSafeById(targetUserId);
  if (!user) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found", [], "NOT_FOUND");
  }

  return user;
}

async function updateUser(actorId, targetUserId, updateData) {
  const actor = await userModel.findUserForAuth(actorId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  const isAdmin = isActorAdmin(actor);
  const allowed = await userModel.isInDownline(actor.id, targetUserId, isAdmin);
  if (!allowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found or not in your hierarchy", [], "NOT_FOUND");
  }

  if (updateData.mobile) {
    const duplicate = await userModel.checkDuplicateUser({
      mobile: updateData.mobile,
      excludeUserId: targetUserId
    });
    if (duplicate) {
      throw new ApiError(httpStatus.CONFLICT, "Mobile number already in use by another user", [], "DUPLICATE_ENTRY");
    }
  }

  await userModel.updateUser(targetUserId, updateData);
  return await userModel.findUserSafeById(targetUserId);
}

async function updateUserStatus(actorId, targetUserId, status) {
  const actor = await userModel.findUserForAuth(actorId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  if (Number(actorId) === Number(targetUserId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot change your own status", [], "SELF_STATUS_MODIFICATION");
  }

  const isAdmin = isActorAdmin(actor);
  const allowed = await userModel.isInDownline(actor.id, targetUserId, isAdmin);
  if (!allowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found or not in your hierarchy", [], "NOT_FOUND");
  }

  await userModel.updateUserStatus(targetUserId, status);
  return { id: targetUserId, status };
}

async function deleteUser(actorId, targetUserId) {
  const actor = await userModel.findUserForAuth(actorId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  if (Number(actorId) === Number(targetUserId)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "You cannot delete your own account", [], "SELF_DELETION_NOT_ALLOWED");
  }

  const isAdmin = isActorAdmin(actor);
  const allowed = await userModel.isInDownline(actor.id, targetUserId, isAdmin);
  if (!allowed) {
    throw new ApiError(httpStatus.NOT_FOUND, "User not found or not in your hierarchy", [], "NOT_FOUND");
  }

  await userModel.deleteUser(targetUserId);
  return { id: targetUserId, deleted: true };
}

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  updateUserStatus,
  deleteUser
};
