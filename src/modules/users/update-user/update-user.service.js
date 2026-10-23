
import pool from "../../../config/db.js";
import userModel from "../user.model.js";
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

    // 4. Reject an email that is unchanged from the current email.
    if (fields.email !== undefined) {
      const newEmail = fields.email.trim().toLowerCase();
      const currentEmail = String(currentUser.email || "")
        .trim()
        .toLowerCase();

      if (newEmail === currentEmail) {
        throw new ApiError(
          httpStatus.BAD_REQUEST,
          "New email must be different from the current email",
          [],
          "VALIDATION_ERROR",
        );
      }
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

    // 7. Fetch a safe profile for the response.
    const updatedUser = await userModel.findUserSafeById(
      targetId,
      connection,
    );

    await connection.commit();

    return updatedUser;
  } catch (error) {
    await connection.rollback();

    // Handle a unique-index collision if another request updates
    // the same email or mobile concurrently.
    if (error?.code === "ER_DUP_ENTRY") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Email or mobile number already belongs to another user",
        [],
        "DUPLICATE_ENTRY",
      );
    }

    throw error;
  } finally {
    connection.release();
  }
}

export { updateUser };
export default { updateUser };
