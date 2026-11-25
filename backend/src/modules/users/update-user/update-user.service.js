
import pool from "../../../config/db.js";
import userModel from "../user.model.js";
import authModel from "../../auth/auth.model.js";
import authSessionCache from "../../auth/authSessionCache.js";
import { isBlockedStatus } from "../../auth/accountStatus.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

async function updateUser({ actorId, targetUserId, fields }) {
  if (!actorId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const targetId = Number(targetUserId);

  if (!Number.isSafeInteger(targetId) || targetId <= 0) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid user ID",
      [],
      "VALIDATION_ERROR",
    );
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Fetch the authenticated actor from the database.
    const actor = await userModel.findUserForAuth(actorId, connection);

    if (!actor) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Active authenticated user not found",
        [],
        "UNAUTHORIZED",
      );
    }

    // 2. Only role ID 1 (Admin) may use this endpoint.
    if (Number(actor.role_id) !== 1) {
      throw new ApiError(
        httpStatus.FORBIDDEN,
        "Only administrators can update users",
        [],
        "FORBIDDEN",
      );
    }

    // 3. Ensure the target user exists.
    const currentUser = await userModel.findUserSafeById(
      targetId,
      connection,
    );

    if (!currentUser) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "User not found",
        [],
        "NOT_FOUND",
      );
    }

    //4. Prevent an administartor from deactivating their own account
    if(Number(actorId) === targetId && fields.status === "inactive"){
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Administrators cannot deactivate their own account",
        [],
        "VALIDATION_ERROR",
      );
    }

    // 5. Check email and mobile uniqueness, excluding this user.
    const emailForCheck =
      fields.email !== undefined ? fields.email : currentUser.email;

    const mobileForCheck =
      fields.mobile !== undefined ? fields.mobile : currentUser.mobile;

    const duplicate = await userModel.checkDuplicateUser(
      {
        email: emailForCheck,
        mobile: mobileForCheck,
        excludeUserId: targetId,
      },
      connection,
    );

    if (duplicate) {
      const emailDuplicate =
        duplicate.email?.toLowerCase() === emailForCheck?.toLowerCase();

      throw new ApiError(
        httpStatus.CONFLICT,
        emailDuplicate
          ? "Email already belongs to another user"
          : "Mobile number already belongs to another user",
        [],
        "DUPLICATE_ENTRY",
      );
    }

    // 6. Update only the fields supplied by the administrator.
    await userModel.updateUserFields(targetId, fields, connection);

    // 7. Terminate every existing session as part of the same transaction
    //    when an account is deactivated/blocked. Bumping token_version makes
    //    all previously issued JWTs fail requireAuth immediately. Reactivating
    //    clears the in-process blocked marker and any Redis auth cache.
    if (fields.status !== undefined) {
      await authSessionCache.clearCachedAuthState(targetId);

      if (isBlockedStatus(fields.status)) {
        try {
          await authModel.revokeUserSessions(targetId, connection);
        } catch (error) {
          // Allow deactivation before migration 011 is applied; the status
          // check in requireAuth still blocks the account immediately.
          const code = String(error?.code || "");
          if (
            code !== "ER_BAD_FIELD_ERROR" &&
            code !== "ER_NO_SUCH_TABLE"
          ) {
            throw error;
          }
        }
        authSessionCache.markAccountBlocked(targetId);
      }
    }

    // 8. Fetch a safe profile for the response.
    const updatedUser = await userModel.findUserSafeById(
      targetId,
      connection,
    );

    await connection.commit();
    connection.release();
    return updatedUser;

} catch (error) {
  let rollbackFailed = false;

  try {
    await connection.rollback();
  } catch {
    rollbackFailed = true;
  }

  if (rollbackFailed) {
    connection.destroy();
  } else {
    connection.release();
  }

  if (error?.code === "ER_DUP_ENTRY") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Email or mobile number already belongs to another user",
      [],
      "DUPLICATE_ENTRY",
    );
  }

  throw error;
  }
}

export { updateUser };
export default { updateUser };
