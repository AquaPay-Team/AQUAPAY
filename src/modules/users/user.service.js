const bcrypt = require("bcrypt");
const pool = require("../../config/db");
const userModel = require("./user.model");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");
const authorizationService = require("../authorization/authorization.service");

async function createUser({ actorId, name, email, mobile, password, roleId }) {
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

    // if (actor.company_status && actor.company_status !== "active") {
    //   throw new ApiError(httpStatus.FORBIDDEN, "Creator company is inactive", [], "FORBIDDEN");
    // }

    // 2. Validate and resolve target child role
    const targetRole = await userModel.findRoleByIdOrName(roleId, connection);
    if (!targetRole) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Requested role does not exist", [], "INVALID_ROLE");
    }

    // 3.Verify whether the target role is below the actor
    const isPermitted = await authorizationService.canCreateRole(
      actor.role_id,
      targetRole.id,
      connection
    );

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

    // 6. Parent ID is ALWAYS derived from the authenticated actor context
    const parentId = actor.id;
    const companyId = actor.company_id || null;

    // 7. Insert the user using the approved MySQL schema
    const newUserId = await userModel.insertUser(
      {
        name,
        email,
        mobile,
        passwordHash,
        roleId: targetRole.id,
        companyId,
        parentId,
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

module.exports = {
  createUser
};
