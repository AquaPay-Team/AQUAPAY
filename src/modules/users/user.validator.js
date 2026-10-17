const {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidEmail,
  isValidMobile,
  isValidStateOrCity
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

  const rawParentId = body.parentId !== undefined ? body.parentId : body.parent_id;
  const parentId = Number(rawParentId) > 0 ? Number(rawParentId) : null;

  req.validatedBody = {
    name,
    email,
    mobile,
    state: state || null,
    city: city || null,
    password: password || null,
    roleId: roleInput,
    parentId
  };

  next();
}

function validateListUsers(req, res, next) {
  const query = req.query || {};
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  const limit = Math.min(100, Math.max(1, Math.floor(Number(query.limit) || 20)));
  const search = normalizeString(query.search);
  const status = normalizeString(query.status).toLowerCase();
  const role = query.roleId || query.role_id || query.role;
  const scope = query.scope === "direct" ? "direct" : "all";

  const validStatuses = ["pending", "active", "suspended", "inactive"];
  if (status && !validStatuses.includes(status)) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        `Status must be one of: ${validStatuses.join(", ")}`,
        [],
        "VALIDATION_ERROR"
      )
    );
  }

  req.validatedQuery = {
    page,
    limit,
    search: search || null,
    status: status || null,
    role: role || null,
    scope
  };

  next();
}

function validateUserIdParam(req, res, next) {
  const id = Number(req.params.id);
  if (isNaN(id) || id <= 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID parameter", [], "VALIDATION_ERROR"));
  }
  req.userIdParam = id;
  next();
}

function validateUpdateUser(req, res, next) {
  const body = req.body || {};
  const updates = {};
  const errors = [];

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      errors.push("Name must be a string containing only letters and spaces");
    } else {
      const trimmedName = body.name.trim();
      if (!trimmedName) {
        errors.push("Name cannot be empty");
      } else if (trimmedName.length < 2) {
        errors.push("Name must contain at least 2 characters");
      } else if (trimmedName.length > 100) {
        errors.push("Name cannot exceed 100 characters");
      } else if (!/^[a-zA-Z\s]+$/.test(trimmedName)) {
        errors.push("Name must contain only letters and spaces");
      } else {
        updates.name = trimmedName;
      }
    }
  }

  if (body.mobile !== undefined) {
    const mobile = normalizeMobile(body.mobile);
    if (!isValidMobile(mobile)) {
      errors.push("Invalid mobile number format (must be 10 digits)");
    } else {
      updates.mobile = mobile;
    }
  }

  if (body.state !== undefined) {
    const state = normalizeString(body.state);
    if (state.length > 100) {
      errors.push("State cannot exceed 100 characters");
    } else {
      updates.state = state || null;
    }
  }

  if (body.city !== undefined) {
    const city = normalizeString(body.city);
    if (city.length > 100) {
      errors.push("City cannot exceed 100 characters");
    } else {
      updates.city = city || null;
    }
  }

  if (errors.length > 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, errors.join(", "), errors, "VALIDATION_ERROR"));
  }

  if (Object.keys(updates).length === 0) {
    return next(new ApiError(httpStatus.BAD_REQUEST, "At least one valid field (name, mobile, state, city) must be provided", [], "VALIDATION_ERROR"));
  }

  req.validatedBody = updates;
  next();
}

function validateUpdateStatus(req, res, next) {
  const body = req.body || {};
  const status = normalizeString(body.status).toLowerCase();
  const validStatuses = ["pending", "active", "suspended", "inactive"];

  if (!status || !validStatuses.includes(status)) {
    return next(new ApiError(httpStatus.BAD_REQUEST, `Status must be one of: ${validStatuses.join(", ")}`, [], "VALIDATION_ERROR"));
  }

  req.validatedBody = { status };
  next();
}

module.exports = {
  validateCreateUser,
  validateListUsers,
  validateUserIdParam,
  validateUpdateUser,
  validateUpdateStatus
};
