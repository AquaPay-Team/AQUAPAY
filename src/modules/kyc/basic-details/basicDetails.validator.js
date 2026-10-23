import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = ["businessType", "shopAddress", "city", "pincode"];

function validateBasicDetails(req, res, next) {
  const body = req.body;

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "Request body must be a valid JSON object",
        ["Request body must be a valid JSON object"],
        "VALIDATION_ERROR",
      ),
    );
  }

  const errors = [];

  // Check for unexpected fields (e.g. read-only fields like name, email, mobile, or arbitrary keys)
  const unknownFields = Object.keys(body).filter((key) => !ALLOWED_FIELDS.includes(key));
  if (unknownFields.length > 0) {
    errors.push(`Unexpected request field(s): ${unknownFields.join(", ")}`);
  }

  // Validate businessType: non-empty string, max 100 characters, free text
  if (body.businessType === undefined || body.businessType === null) {
    errors.push("Business type is required");
  } else if (typeof body.businessType !== "string") {
    errors.push("Business type must be a string");
  } else {
    const trimmedBusinessType = body.businessType.trim();
    if (!trimmedBusinessType) {
      errors.push("Business type is required");
    } else if (trimmedBusinessType.length > 100) {
      errors.push("Business type must not exceed 100 characters");
    }
  }

  // Validate shopAddress: non-empty string, max 255 characters
  if (body.shopAddress === undefined || body.shopAddress === null) {
    errors.push("Shop address is required");
  } else if (typeof body.shopAddress !== "string") {
    errors.push("Shop address must not exceed 255 characters and must be a string");
  } else {
    const trimmedShopAddress = body.shopAddress.trim();
    if (!trimmedShopAddress) {
      errors.push("Shop address is required");
    } else if (trimmedShopAddress.length > 255) {
      errors.push("Shop address must not exceed 255 characters");
    }
  }

  // Validate city: non-empty string, max 100 characters
  if (body.city === undefined || body.city === null) {
    errors.push("City is required");
  } else if (typeof body.city !== "string") {
    errors.push("City must not exceed 100 characters and must be a string");
  } else {
    const trimmedCity = body.city.trim();
    if (!trimmedCity) {
      errors.push("City is required");
    } else if (trimmedCity.length > 100) {
      errors.push("City must not exceed 100 characters");
    }
  }

  // Validate pincode: must be a string, up to 10 characters, preserving leading zeros, 6-digit postal format
  if (body.pincode === undefined || body.pincode === null) {
    errors.push("Pincode is required");
  } else if (typeof body.pincode !== "string") {
    errors.push("Pincode must be a string");
  } else {
    const trimmedPincode = body.pincode.trim();
    if (!trimmedPincode) {
      errors.push("Pincode is required");
    } else if (trimmedPincode.length > 10) {
      errors.push("Pincode must not exceed 10 characters");
    } else if (!/^\d{6}$/.test(trimmedPincode)) {
      errors.push("Invalid pincode (must be a 6-digit postal code)");
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

  req.validatedBody = {
    businessType: body.businessType.trim(),
    shopAddress: body.shopAddress.trim(),
    city: body.city.trim(),
    pincode: body.pincode.trim(),
  };

  next();
}

export { validateBasicDetails };
export default { validateBasicDetails };
