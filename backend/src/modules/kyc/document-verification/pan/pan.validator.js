import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";

const PAN_NUMBER_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

function validatePanVerificationInput(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid PAN verification request", [], "VALIDATION_ERROR");
  }

  const keys = Object.keys(input);
  if (keys.some((key) => !["panNumber", "consent"].includes(key))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid PAN verification request", [], "VALIDATION_ERROR");
  }

  const panNumber = typeof input.panNumber === "string"
    ? input.panNumber.trim().toUpperCase()
    : "";
  if (!PAN_NUMBER_PATTERN.test(panNumber)) {
    throw new ApiError(httpStatus.BAD_REQUEST, "A valid PAN number is required", [], "PAN_NUMBER_INVALID");
  }
  if (input.consent !== true) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Explicit PAN verification consent is required", [], "PAN_CONSENT_REQUIRED");
  }
  return Object.freeze({ panNumber, consent: true });
}

function validatePanVerificationRequest(req, res, next) {
  try {
    req.validatedPanRequest = validatePanVerificationInput(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

function validatePanDetailedResponse(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new Error("INVALID_PAN_PROVIDER_RESPONSE");
  }
  if (!Object.hasOwn(response, "error_code")) {
    throw new Error("INVALID_PAN_PROVIDER_RESPONSE");
  }
  if (response.error_code !== null) {
    throw new Error("PAN_PROVIDER_BUSINESS_ERROR");
  }
  if (
    response.status !== "success" ||
    !response.data ||
    typeof response.data !== "object" ||
    Array.isArray(response.data)
  ) {
    throw new Error("INVALID_PAN_PROVIDER_RESPONSE");
  }

  const panNumber = response.data.pan_number;
  const verifiedName = response.data.full_name;
  if (typeof panNumber !== "string" || !PAN_NUMBER_PATTERN.test(panNumber)) {
    throw new Error("INVALID_PAN_PROVIDER_RESPONSE");
  }
  if (
    typeof verifiedName !== "string" ||
    !verifiedName.trim() ||
    verifiedName.length > 150 ||
    /[\u0000-\u001f\u007f]/.test(verifiedName)
  ) {
    throw new Error("PAN_VERIFIED_NAME_UNAVAILABLE");
  }

  return Object.freeze({
    panNumber,
    verifiedName: verifiedName.trim().replace(/\s+/g, " "),
    maskedIdentifier: `XXXXXX${panNumber.slice(-4)}`,
  });
}

export {
  validatePanDetailedResponse,
  validatePanVerificationInput,
  validatePanVerificationRequest,
};
export default {
  validatePanDetailedResponse,
  validatePanVerificationInput,
  validatePanVerificationRequest,
};
