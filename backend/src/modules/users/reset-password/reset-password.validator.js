import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import { getPasswordConfig } from "../../../config/auth.js";

function validateAdminPasswordReset(req, res, next) {
  const body = req.body;
  const config = getPasswordConfig();
  const errors = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be a JSON object");
  } else {
    if (Object.keys(body).some((key) => !["newPassword", "confirmPassword"].includes(key))) {
      errors.push("Unexpected request field");
    }
    if (typeof body.newPassword !== "string" || body.newPassword.length < config.passwordMinLength) {
      errors.push(`Password must contain at least ${config.passwordMinLength} characters`);
    } else if (Buffer.byteLength(body.newPassword, "utf8") > 72) {
      errors.push("Password must not exceed 72 bytes");
    }
    if (typeof body.confirmPassword !== "string" || body.confirmPassword !== body.newPassword) {
      errors.push("Password confirmation does not match");
    }
  }
  if (errors.length) {
    return next(new ApiError(httpStatus.BAD_REQUEST, errors.join(", "), errors, "VALIDATION_ERROR"));
  }
  req.validatedBody = { newPassword: body.newPassword };
  return next();
}

export { validateAdminPasswordReset };
