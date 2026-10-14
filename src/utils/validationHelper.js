import ApiError from "./ApiError.js";

export function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeEmail(value) {
  const email = normalizeString(value).toLowerCase();
  return email || null;
}

export function normalizeMobile(value) {
  return normalizeString(String(value ?? ""));
}

export function isValidEmail(value) {
  return typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function isValidMobile(value) {
  return typeof value === "string" &&
    /^\+?[0-9]{8,15}$/.test(value.trim());
}

export function validateCreateUserInput(body = {}) {
  const name = normalizeString(body.name);
  const email = body.email == null || body.email === ""
    ? null
    : normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const password = body.password;
  const roleSlug = normalizeString(body.role).toUpperCase();
  const errors = [];

  if (!name) errors.push("Name is required.");
  if (!isValidMobile(mobile)) errors.push("A valid mobile number is required.");
  if (email && !isValidEmail(email)) errors.push("A valid email address is required.");
  if (typeof password !== "string" || password.length < 12) {
    errors.push("Password must contain at least 12 characters.");
  }
  if (!roleSlug) errors.push("Role is required.");

  if (errors.length) {
    throw new ApiError(422, "Validation failed", errors);
  }

  return { name, email, mobile, password, roleSlug };
}
