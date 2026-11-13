import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";

class DigiLockerProviderError extends Error {
  constructor(code, statusCode, responseMetadata, cause) {
    super("DigiLocker provider request failed", cause === undefined ? undefined : { cause });
    this.name = "DigiLockerProviderError";
    this.code = code;
    if (Number.isInteger(statusCode)) this.statusCode = statusCode;
    if (responseMetadata && typeof responseMetadata === "object") this.responseMetadata = responseMetadata;
  }
}

function safeFailureCode(error) {
  if (typeof error?.code === "string" && /^[A-Z0-9_]{1,100}$/.test(error.code)) return error.code;
  if (typeof error?.message === "string" && /^[A-Z0-9_]{1,100}$/.test(error.message)) return error.message;
  return "DIGILOCKER_PROVIDER_ERROR";
}

function toPublicError(error) {
  if (error instanceof ApiError) return error;
  const code = safeFailureCode(error);
  const mappings = {
    CONSENT_NOT_PROVIDED: [403, "DigiLocker consent was not provided"],
    DOC_NOT_FOUND: [httpStatus.UNPROCESSABLE_ENTITY, "Aadhaar document was not available"],
    REFERENCE_KEY_EXPIRED: [410, "DigiLocker authorization has expired; start again"],
    DOC_UNAVAILABLE: [httpStatus.SERVICE_UNAVAILABLE, "Aadhaar document service is temporarily unavailable"],
    INVALID_AADHAAR_DOCUMENT: [httpStatus.UNPROCESSABLE_ENTITY, "Aadhaar document could not be verified"],
    INVALID_PAN_DOCUMENT: [httpStatus.UNPROCESSABLE_ENTITY, "PAN document could not be verified"],
    INVALID_DOCUMENT_SIGNATURE: [httpStatus.UNPROCESSABLE_ENTITY, "Document signature could not be verified"],
  };
  const mapping = mappings[code] || [httpStatus.SERVICE_UNAVAILABLE, "DigiLocker verification is temporarily unavailable"];
  return new ApiError(mapping[0], mapping[1], [], code);
}

export { DigiLockerProviderError, safeFailureCode, toPublicError };
