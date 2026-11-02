import {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidEmail,
  isValidMobile,
  isValidShopname,
  isValidStateOrCity,
  isValidAddress,
  isValidPincode,
} from "../../utils/validationHelper.js";
import ApiError from "../../utils/ApiError.js";
import httpStatus from "../../utils/httpStatus.js";
import { getPasswordConfig } from "../../config/auth.js";

function validateCreateUser(req, res, next) {
  const body = req.body || {};
  const name = normalizeString(body.name);
  const email = normalizeEmail(body.email);
  const mobile = normalizeMobile(body.mobile);
  const shopname = normalizeString(body.shopname);
  const address = normalizeString(body.address);
  const state = normalizeString(body.state);
  const city = normalizeString(body.city);
  const pincode =
    body.pincode !== undefined && body.pincode !== null
      ? String(body.pincode).trim()
      : "";
  const password = body.password;
  const rawBusinessType =
    body.businessType !== undefined ? body.businessType : body.business_type;
  const businessType = normalizeString(rawBusinessType);
  const roleInput =
    body.roleId !== undefined
      ? body.roleId
      : body.role_id !== undefined
        ? body.role_id
        : body.role;

  const errors = [];
  const passwordConfig = getPasswordConfig();

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

  // Password validation: at least 8 characters and at most 72 UTF-8 bytes
  if (typeof password !== "string" || !password) {
    errors.push("Password is required");
  } else if (password.length < passwordConfig.passwordMinLength) {
    errors.push(
      `Password must contain at least ${passwordConfig.passwordMinLength} characters`,
    );
  } else if (Buffer.byteLength(password, "utf8") > 72) {
    errors.push("Password must not exceed 72 bytes");
  }

  // Shopname validation (max 150 chars)
  if (body.shopname !== undefined && body.shopname !== null) {
    if (typeof body.shopname !== "string") {
      errors.push("Shop name must be a string");
    } else if (!isValidShopname(body.shopname)) {
      errors.push("Shop name cannot exceed 150 characters");
    }
  }

  // Address validation (max 255 chars)
  if (body.address !== undefined && body.address !== null) {
    if (typeof body.address !== "string") {
      errors.push("Address must be a string");
    } else if (!isValidAddress(body.address)) {
      errors.push("Address cannot exceed 255 characters");
    }
  }

  if (body.state !== undefined && body.state !== null) {
    if (typeof body.state !== "string") {
      errors.push("State must be a string");
    } else if (!isValidStateOrCity(body.state)) {
      errors.push("State cannot exceed 100 characters");
    }
  }

  // City validation
  if (body.city !== undefined && body.city !== null) {
    if (typeof body.city !== "string") {
      errors.push("City must be a string");
    } else if (!isValidStateOrCity(body.city)) {
      errors.push("City cannot exceed 100 characters");
    }
  }

  // Pincode validation (6-digit Indian postal code)
  if (
    body.pincode !== undefined &&
    body.pincode !== null &&
    body.pincode !== ""
  ) {
    if (typeof body.pincode !== "string" && typeof body.pincode !== "number") {
      errors.push("Invalid pincode (must be a 6-digit postal code)");
    } else if (!isValidPincode(pincode)) {
      errors.push("Invalid pincode (must be a 6-digit postal code)");
    }
  }

  // Business type validation (optional, max 100 chars)
  if (
    rawBusinessType !== undefined &&
    rawBusinessType !== null &&
    rawBusinessType !== ""
  ) {
    if (typeof rawBusinessType !== "string") {
      errors.push("Business type must be a string");
    } else if (rawBusinessType.trim().length > 100) {
      errors.push("Business type cannot exceed 100 characters");
    }
  }

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

  if (errors.length > 0) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        errors.join(", "),
        errors,
        "VALIDATION_ERROR",
      ),
    );
  }

  const parsedRoleId =
    typeof roleInput === "string" && /^\d+$/.test(roleInput.trim())
      ? Number(roleInput.trim())
      : roleInput;

  req.validatedBody = {
    name,
    email,
    mobile,
    shopname: shopname || null,
    address: address || null,
    state: state || null,
    city: city || null,
    pincode: pincode || null,
    password,
    roleId: parsedRoleId,
    businessType: businessType || null,
  };

  next();
}

export { validateCreateUser };

export default {
  validateCreateUser,
};
