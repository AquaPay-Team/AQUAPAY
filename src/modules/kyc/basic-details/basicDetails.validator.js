import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import { isValidPincode } from "../../../utils/validationHelper.js";

const ALLOWED_FIELDS = new Set([
  "businessType",
  "shopAddress",
  "city",
  "pincode",
]);

function validateBasicDetails(req, res, next) {
  const body = req.body;
  const errors = [];

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

  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) errors.push(`Unexpected request field: ${field}`);
  }

  const businessType = typeof body.businessType === "string"
    ? body.businessType.trim()
    : "";
  const shopAddress = typeof body.shopAddress === "string"
    ? body.shopAddress.trim()
    : "";
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const pincode =
    typeof body.pincode === "string" || typeof body.pincode === "number"
      ? String(body.pincode).trim()
      : "";

  if (!businessType) errors.push("Business type is required");
  else if (businessType.length > 100) errors.push("Business type must not exceed 100 characters");

  if (!shopAddress) errors.push("Shop address is required");
  else if (shopAddress.length > 255) errors.push("Shop address must not exceed 255 characters");

  if (!city) errors.push("City is required");
  else if (city.length > 100) errors.push("City must not exceed 100 characters");

  if (!isValidPincode(pincode)) {
    errors.push("Pincode must be a valid 6-digit postal code");
  }

  if (errors.length) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        errors.join(", "),
        errors,
        "VALIDATION_ERROR",
      ),
    );
  }

  req.validatedBody = { businessType, shopAddress, city, pincode };
  return next();
}

function validateKycOtpRequest(req, res, next) {
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
  if (Object.keys(body).length > 0) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "OTP request body must be empty",
        ["OTP request body must be empty"],
        "VALIDATION_ERROR",
      ),
    );
  }
  return next();
}

function validateKycOtp(req, res, next) {
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
  const keys = Object.keys(body);
  if (
    keys.length !== 1 ||
    keys[0] !== "otp" ||
    typeof body.otp !== "string" ||
    !/^\d{6}$/.test(body.otp)
  ) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "A six-digit OTP is required",
        ["A six-digit OTP is required"],
        "VALIDATION_ERROR",
      ),
    );
  }
  req.validatedOtp = body.otp;
  return next();
}

export { validateBasicDetails, validateKycOtpRequest, validateKycOtp };
export default { validateBasicDetails, validateKycOtpRequest, validateKycOtp };
