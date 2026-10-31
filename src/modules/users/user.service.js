import bcrypt from "bcryptjs";
import pool from "../../config/db.js";
import userModel from "./user.model.js";
import ApiError from "../../utils/ApiError.js";
import httpStatus from "../../utils/httpStatus.js";
import authorizationService from "../authorization/authorization.service.js";
import { normalizeMobile } from "../../utils/validationHelper.js";
import { getPasswordConfig } from "../../config/auth.js";

async function createUser({
  actorId,
  name,
  email,
  mobile,
  shopname,
  address,
  state,
  city,
  pincode,
  password,
  roleId,
  businessType,
}) {
  if (!actorId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required to create a user",
      [],
      "UNAUTHORIZED",
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Authenticate requester and fetch creator context
    const actor = await userModel.findUserForAuth(actorId, connection);
    if (!actor) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Active authenticated creator not found",
        [],
        "UNAUTHORIZED",
      );
    }

    // 2. Validate and resolve target child role
    const targetRole = await userModel.findRoleByIdOrName(roleId, connection);
    if (!targetRole) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Requested role does not exist",
        [],
        "INVALID_ROLE",
      );
    }

    // 3. Verify whether the actor can create the target role.
    const isPermitted = await authorizationService.canCreateRole(
      actor.role_id,
      targetRole.id,
      connection,
    );
    if (!isPermitted) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        `Role '${actor.role_name}' is not authorized to create a '${targetRole.name}'`,
        [],
        "FORBIDDEN",
      );
    }

    // 4. Normalize mobile and email, and check whether duplicate already exists
    const normalizedMobile = normalizeMobile(mobile);
    const normalizedEmail = email ? email.trim().toLowerCase() : email;

    const duplicate = await userModel.checkDuplicateUser(
      { email: normalizedEmail, mobile: normalizedMobile },
      connection,
    );

    if (duplicate) {
      const field = duplicate.email === normalizedEmail ? "Email" : "Mobile number";
      throw new ApiError(
        httpStatus.CONFLICT,
        `${field} already exists`,
        [],
        "DUPLICATE_ENTRY",
      );
    }

    // 5. Validate and hash password before storing
    const passwordConfig = getPasswordConfig();
    if (
      typeof password !== "string" ||
      password.length < passwordConfig.passwordMinLength ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        typeof password !== "string" || !password
          ? "Password is required"
          : password.length < passwordConfig.passwordMinLength
            ? `Password must contain at least ${passwordConfig.passwordMinLength} characters`
            : "Password must not exceed 72 bytes",
        [],
        "VALIDATION_ERROR",
      );
    }
    const passwordHash = await bcrypt.hash(password, passwordConfig.bcryptSaltRounds);

    // 6. Parent ID is the authenticated creator
    const parentId = actor.id;
    const companyId = actor.company_id || null;

    // 7. Insert the user using the approved database schema
    const newUserId = await userModel.insertUser(
      {
        name,
        email: normalizedEmail,
        mobile: normalizedMobile,
        shopname: shopname || null,
        address: address || null,
        state: state || null,
        city: city || null,
        pincode: pincode || null,
        passwordHash,
        roleId: targetRole.id,
        companyId,
        parentId,
        status: "active",
      },
      connection,
    );

    // 8. Initialize Phase 2 KYC Case for non-admin accounts
    if (targetRole.id !== 1) {
      await userModel.initKycCaseForUser(
        {
          userId: newUserId,
          businessType: businessType || null,
          actorId: actor.id,
        },
        connection,
      );
    }

    // 9. Fetch the created user without password or password_hash
    const newUser = await userModel.findUserSafeById(newUserId, connection);

    // 10. Commit transaction
    await connection.commit();

    return newUser;
  } catch (error) {
    try {
      await connection.rollback();
    } catch (rollbackError) {
      // Preserve the original error if rollback also fails.
    }

    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "An account with this email or mobile already exists",
        [],
        "DUPLICATE_ENTRY",
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

const userService = {
  createUser,
};

export {
  createUser,
};

export default userService;
