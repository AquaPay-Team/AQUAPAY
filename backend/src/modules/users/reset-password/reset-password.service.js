import bcrypt from "bcryptjs";
import model from "./reset-password.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import { getPasswordConfig } from "../../../config/auth.js";

async function resetSubordinatePassword({ actorId, targetUserId, newPassword }) {
  const targetId = Number(targetUserId);
  if (!Number.isSafeInteger(targetId) || targetId <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID", [], "VALIDATION_ERROR");
  }
  const connection = await model.getConnection();
  try {
    await connection.beginTransaction();
    const actor = await model.findActiveUserForUpdate(connection, actorId);
    if (!actor) throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
    if (Number(actor.role_id) !== 1) {
      throw new ApiError(httpStatus.FORBIDDEN, "Only administrators may reset another user's password", [], "FORBIDDEN");
    }
    const target = await model.findTargetForUpdate(connection, targetId);
    if (!target || Number(target.role_id) === 1 || !(await model.isDescendant(connection, actor.id, target.id))) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", [], "NOT_FOUND");
    }
    const config = getPasswordConfig();
    if (typeof newPassword !== "string" || newPassword.length < config.passwordMinLength || Buffer.byteLength(newPassword, "utf8") > 72) {
      throw new ApiError(httpStatus.BAD_REQUEST, "New password does not meet the password policy", [], "VALIDATION_ERROR");
    }
    const passwordHash = await bcrypt.hash(newPassword, config.bcryptSaltRounds);
    if (!(await model.updatePasswordHash(connection, target.id, passwordHash))) {
      throw new Error("Password update did not affect one user");
    }
    await connection.commit();
    return { message: "User password reset successfully" };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

export { resetSubordinatePassword };
export default { resetSubordinatePassword };
