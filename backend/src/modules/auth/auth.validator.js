import ApiError from "../../utils/ApiError.js";
import { getAuthConfig } from "../../config/auth.js";

function normalizeIdentifier(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 254) return null;
  const email = trimmed.toLowerCase();
  const separator = email.indexOf("@");
  const localPart = separator >= 0 ? email.slice(0, separator) : "";
  const domain = separator >= 0 ? email.slice(separator + 1) : "";
  const validLocal = /^[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+)*$/.test(localPart);
  const validDomain = /^(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/.test(domain);
  if (separator === email.lastIndexOf("@") && localPart.length <= 64 && validLocal && validDomain) {
    return { identifier: email, type: "email" };
  }
  if (/^\+?\d{10,15}$/.test(trimmed)) {
    return { identifier: trimmed, type: "mobile" };
  }
  return null;
}

function bodyObject(req) {
  return req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {};
}

function rejectUnknownKeys(body, allowed) {
  return Object.keys(body).some((key) => !allowed.includes(key));
}

function validateLogin(req, res, next) {
  const body = bodyObject(req);
  const normalized = normalizeIdentifier(body.identifier);
  const password = body.password;
  const errors = [];
  if (!normalized) errors.push("A valid email address or mobile number is required");
  if (typeof password !== "string" || password.length === 0) errors.push("Password is required");
  else if (Buffer.byteLength(password, "utf8") > 72) errors.push("Password must not exceed 72 bytes");
  if (rejectUnknownKeys(body, ["identifier", "password"])) errors.push("Unexpected request field");
  if (errors.length) return next(new ApiError(400, errors.join(", "), "VALIDATION_ERROR"));
  req.validatedBody = { ...normalized, password };
  return next();
}

function validateForgotPassword(req, res, next) {
  const body = bodyObject(req);
  const normalized = normalizeIdentifier(body.identifier);
  if (!normalized || rejectUnknownKeys(body, ["identifier"])) {
    return next(new ApiError(400, "A valid email address or mobile number is required", "VALIDATION_ERROR"));
  }
  req.validatedBody = normalized;
  return next();
}

function validateResetPassword(req, res, next) {
  const body = bodyObject(req);
  const config = getAuthConfig();
  const errors = [];
  if (typeof body.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) {
    errors.push("A valid password reset token is required");
  }
  if (typeof body.otp !== "string" || !/^\d{6}$/.test(body.otp)) {
    errors.push("A valid 6-digit OTP is required");
  }
  if (typeof body.password !== "string" || body.password.length < config.passwordMinLength) {
    errors.push(`Password must contain at least ${config.passwordMinLength} characters`);
  } else if (Buffer.byteLength(body.password, "utf8") > 72) {
    errors.push("Password must not exceed 72 bytes");
  }
  if (rejectUnknownKeys(body, ["token", "otp", "password"])) errors.push("Unexpected request field");
  if (errors.length) return next(new ApiError(400, errors.join(", "), "VALIDATION_ERROR"));
  req.validatedBody = { token: body.token, otp: body.otp, password: body.password };
  return next();
}

export { normalizeIdentifier, validateLogin, validateForgotPassword, validateResetPassword };

export default {
  normalizeIdentifier,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};
