
import {
  normalizeString,
  normalizeMobile,
  isValidName,
  normalizeEmail,
  isValidEmail,
  isValidMobile,
  isValidShopname,
  isValidStateOrCity,
  isValidAddress,
  isValidPincode,
} from "../../../utils/validationHelper.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = new Set([
  "name",
  "email",
  "mobile",
  "shopname",
  "address",
  "state",
  "city",
  "pincode",
]);

function validateUpdateUser(req, res, next) {
  const body = req.body;
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    errors.push("Request body must be a JSON object");
  } else {
    const fields = Object.keys(body);
    const invalidFields = fields.filter(
      (field) => !ALLOWED_FIELDS.has(field),
    );

    if (invalidFields.length > 0) {
      errors.push(`Fields cannot be updated: ${invalidFields.join(", ")}`);
    }

    if (fields.length === 0) {
      errors.push("At least one field must be provided");
    }

    const validatedBody = {};

    if (body.name !== undefined) {
      if (!isValidName(body.name)) {
        errors.push("Name must contain 2 to 100 letters and spaces");
      } else {
        validatedBody.name = normalizeString(body.name);
      }
    }

    
    if (body.email !== undefined) {
    if (typeof body.email !== "string" || !body.email.trim()) {
        errors.push("Email cannot be empty");
    } else if (body.email.trim().length > 254) {
        errors.push("Email cannot exceed 254 characters");
    } else if (!isValidEmail(body.email)) {
        errors.push("Invalid email format");
    } else {
        validatedBody.email = normalizeEmail(body.email);
    }
    }

    if (body.mobile !== undefined) {
      const mobile = normalizeMobile(body.mobile);

      if (!isValidMobile(mobile)) {
        errors.push("Invalid mobile number format");
      } else {
        validatedBody.mobile = mobile;
      }
    }

    if (body.shopname !== undefined) {
      if (!isValidShopname(body.shopname)) {
        errors.push("Shop name must be a string of at most 150 characters");
      } else {
        validatedBody.shopname = normalizeString(body.shopname) || null;
      }
    }

    if (body.address !== undefined) {
      if (!isValidAddress(body.address)) {
        errors.push("Address must be a string of at most 255 characters");
      } else {
        validatedBody.address = normalizeString(body.address) || null;
      }
    }

    for (const field of ["state", "city"]) {
      if (body[field] === undefined) continue;

      if (!isValidStateOrCity(body[field])) {
        errors.push(`${field} must be a string of at most 100 characters`);
      } else {
        validatedBody[field] = normalizeString(body[field]) || null;
      }
    }

    if (body.pincode !== undefined) {
      const pincode =
        body.pincode === null ? "" : String(body.pincode).trim();

      if (
        body.pincode !== null &&
        body.pincode !== "" &&
        !isValidPincode(pincode)
      ) {
        errors.push("Pincode must be a valid 6-digit postal code");
      } else {
        validatedBody.pincode = pincode || null;
      }
    }

    if (errors.length === 0) {
      req.validatedBody = validatedBody;
    }
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

  return next();
}

export { validateUpdateUser };
export default { validateUpdateUser };
