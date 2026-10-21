import {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidEmail,
  isValidMobile,
} from "../../utils/validationHelper.js";
import ApiError from "../../utils/ApiError.js";
import httpStatus from "../../utils/httpStatus.js";

function validateCreateUser(req, res, next) {
  const body = req.body || {};
  const name = normalizeString(body.name);
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const state = normalizeString(body.state);
  const city = normalizeString(body.city);
  const password = body.password;
  const roleInput =
    body.roleId !== undefined
      ? body.roleId
      : body.role_id !== undefined
        ? body.role_id
        : body.role;

  const errors = [];

  // Name validation: string only, only alphabetic characters and spaces, 2 to 100 characters
  if (body.name === undefined || body.name === null || body.name === "") {
    errors.push("Name is required");
  } else if (typeof body.name !== "string") {
    errors.push("Name must be a string containing only letters and spaces");
  } else {
    const trimmedName = body.name.trim();
    if (!trimmedName) {
      errors.push("Name is required");
    } else if (trimmedName.length < 2) {
      errors.push("Name must contain at least 2 characters");
    } else if (trimmedName.length > 100) {
      errors.push("Name cannot exceed 100 characters");
    } else if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
      errors.push("Name must contain only letters and spaces");
    }
  }

  // Email validation: RFC format and max 254 chars
  if (!body.email || !normalizeString(body.email)) {
    errors.push("Email is required");
  } else if (!isValidEmail(body.email)) {
    errors.push("Invalid email format");
  } else if (body.email.length > 254) {
    errors.push("Email cannot exceed 254 characters");
  }

  // Mobile validation: 10 digits Indian format
  if (!mobile) {
    errors.push("Mobile number is required");
  } else if (!isValidMobile(mobile)) {
    errors.push("Invalid mobile number format (must be 10 digits)");
  }

  // Password validation: 8 to 128 characters
  if (typeof password !== "string" || !password) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Password must contain at least 8 characters");
  } else if (password.length > 128) {
    errors.push("Password cannot exceed 128 characters");
  }

  // State & City length validation (max 100 chars)
  // State validation
  if (body.state !== undefined && body.state !== null) {
    if (typeof body.state !== "string") {
      errors.push("State must be a string");
    } else if (body.state.trim().length > 100) {
      errors.push("State cannot exceed 100 characters");
    }
  }

  // City validation
  if (body.city !== undefined && body.city !== null) {
    if (typeof body.city !== "string") {
      errors.push("City must be a string");
    } else if (body.city.trim().length > 100) {
      errors.push("City cannot exceed 100 characters");
    }
  }

  // Role validation
  // Role validation
  if (
    roleInput === undefined ||
    roleInput === null ||
    (typeof roleInput === "string" && !roleInput.trim())
  ) {
    errors.push("Role is required");
  } else if (typeof roleInput !== "string" && typeof roleInput !== "number") {
    errors.push("Role must be a valid role ID, name, or slug");
  } else if (
    typeof roleInput === "number" &&
    (!Number.isSafeInteger(roleInput) || roleInput <= 0)
  ) {
    errors.push("Role ID must be a positive integer");
  } else if (
    typeof roleInput === "string" &&
    /^\d+$/.test(roleInput.trim()) &&
    (!Number.isSafeInteger(Number(roleInput.trim())) ||
      Number(roleInput.trim()) <= 0)
  ) {
    errors.push("Role ID must be a positive integer");
  }

  next();
}

export {
  validateCreateUser,
};

export default {
  validateCreateUser,
};
