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
  const password = body.password;
  const roleInput = body.role_id !== undefined ? body.role_id : (body.roleId !== undefined ? body.roleId : body.role);

  const errors = [];

  if (!name) {
    errors.push("Name is required");
  } else if (name.length < 2) {
    errors.push("Name must contain at least 2 characters");
  }

  if (!body.email || !normalizeString(body.email)) {
    errors.push("Email is required");
  } else if (!isValidEmail(body.email)) {
    errors.push("Invalid email format");
  }

  if (!mobile) {
    errors.push("Mobile number is required");
  } else if (!isValidMobile(mobile)) {
    errors.push("Invalid mobile number format (must be 10-15 digits)");
  }

  if (typeof password !== "string" || !password) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Password must contain at least 8 characters");
  }

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
    password,
    roleId: roleInput
  };

  next();
}

module.exports = {
  validateCreateUser
};

