const {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidEmail,
  isValidMobile
} = require("../../utils/validationHelper");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");

function validateCreateUser(req, res, next) {
  const body = req.body || {};
  const name = normalizeString(body.name);
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const state = normalizeString(body.state);
  const city = normalizeString(body.city);
  const password = body.password;
  const roleInput = body.roleId !== undefined ? body.roleId : (body.role_id !== undefined ? body.role_id : body.role);

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
  if (state && state.length > 100) {
    errors.push("State cannot exceed 100 characters");
  }

  if (city && city.length > 100) {
    errors.push("City cannot exceed 100 characters");
  }

  // Role validation
  if (roleInput === undefined || roleInput === null || roleInput === "") {
    errors.push("Role is required");
  }

  if (errors.length > 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, errors.join(", "), errors, "VALIDATION_ERROR"));
  }

  req.validatedBody = {
    name,
    email,
    mobile,
    state: state || null,
    city: city || null,
    password: password || null,
    roleId: roleInput
  };

  next();
}

module.exports = {
  validateCreateUser
};
