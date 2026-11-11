import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import digilockerModel from "../digilocker/digilocker.model.js";
import panModel from "./pan.model.js";
import panProvider from "./pan.provider.js";
import {
  validatePanDetailedResponse,
  validatePanVerificationInput,
} from "./pan.validator.js";
import { compareFullNames } from "./pan.nameMatching.js";

const PROVIDER_ERROR_MAP = Object.freeze({
  IDTO_001: [httpStatus.BAD_REQUEST, "PAN_INVALID", "The PAN number is invalid"],
  IDTO_004: [httpStatus.CONFLICT, "PAN_DUPLICATE_REFERENCE", "This PAN verification request was already processed"],
  IDTO_005: [httpStatus.BAD_REQUEST, "PAN_CONSENT_REQUIRED", "PAN verification consent is required"],
  IDTO_006: [httpStatus.TOO_MANY_REQUESTS, "PAN_RATE_LIMITED", "PAN verification is temporarily rate limited"],
  IDTO_007: [httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_CONFIGURATION_ERROR", "PAN verification is temporarily unavailable"],
  IDTO_008: [httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_BUSY", "PAN verification is temporarily unavailable"],
  IDTO_009: [httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_UNAVAILABLE", "PAN verification is temporarily unavailable"],
  IDTO_202: [httpStatus.UNPROCESSABLE_ENTITY, "PAN_NOT_FOUND", "The PAN could not be verified"],
});

function apiError(status, code, message) {
  return new ApiError(status, message, [], code);
}

function mapAadhaarLookupError(error) {
  const mappings = {
    INVALID_USER_ID: [httpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required"],
    KYC_CASE_NOT_FOUND: [httpStatus.NOT_FOUND, "KYC_CASE_NOT_FOUND", "KYC case was not initialized"],
    KYC_CASE_AMBIGUOUS: [httpStatus.CONFLICT, "KYC_CASE_AMBIGUOUS", "KYC case cannot be resolved"],
    AADHAAR_VERIFICATION_NOT_COMPLETED: [httpStatus.CONFLICT, "AADHAAR_PREREQUISITE_NOT_COMPLETED", "Complete Aadhaar verification before PAN verification"],
    AADHAAR_VERIFICATION_AMBIGUOUS: [httpStatus.CONFLICT, "AADHAAR_VERIFICATION_UNAVAILABLE", "Verified Aadhaar details are unavailable"],
    AADHAAR_VERIFIED_NAME_UNAVAILABLE: [httpStatus.CONFLICT, "AADHAAR_VERIFIED_NAME_UNAVAILABLE", "Verified Aadhaar name is unavailable"],
  };
  const match = mappings[error?.code || error?.message];
  return match
    ? apiError(match[0], match[1], match[2])
    : apiError(httpStatus.SERVICE_UNAVAILABLE, "KYC_SERVICE_UNAVAILABLE", "KYC service is temporarily unavailable");
}

function mapModelError(error) {
  const mappings = {
    USER_NOT_ACTIVE: [httpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required"],
    KYC_CASE_NOT_FOUND: [httpStatus.NOT_FOUND, "KYC_CASE_NOT_FOUND", "KYC case was not initialized"],
    KYC_CASE_AMBIGUOUS: [httpStatus.CONFLICT, "KYC_CASE_AMBIGUOUS", "KYC case cannot be resolved"],
    KYC_CASE_NOT_EDITABLE: [httpStatus.CONFLICT, "KYC_CASE_NOT_EDITABLE", "KYC case cannot be edited"],
    KYC_PREREQUISITE_NOT_COMPLETED: [httpStatus.CONFLICT, "AADHAAR_PREREQUISITE_NOT_COMPLETED", "Complete Aadhaar verification before PAN verification"],
    KYC_STEP_NOT_INITIALIZED: [httpStatus.CONFLICT, "KYC_STEP_NOT_INITIALIZED", "PAN verification is not initialized for this case"],
    VERIFICATION_ALREADY_COMPLETED: [httpStatus.CONFLICT, "PAN_ALREADY_VERIFIED", "PAN verification is already completed"],
    VERIFICATION_IN_PROGRESS: [httpStatus.CONFLICT, "PAN_VERIFICATION_IN_PROGRESS", "PAN verification is already in progress"],
    AADHAAR_VERIFICATION_AMBIGUOUS: [httpStatus.CONFLICT, "AADHAAR_VERIFICATION_UNAVAILABLE", "Verified Aadhaar details are unavailable"],
    AADHAAR_VERIFIED_NAME_CHANGED: [httpStatus.CONFLICT, "AADHAAR_VERIFIED_NAME_CHANGED", "Verified Aadhaar details changed; restart PAN verification"],
    VERIFICATION_SESSION_NOT_FOUND: [httpStatus.CONFLICT, "PAN_VERIFICATION_NOT_ACTIVE", "PAN verification session is no longer active"],
    VERIFICATION_SESSION_NOT_ACTIVE: [httpStatus.CONFLICT, "PAN_VERIFICATION_NOT_ACTIVE", "PAN verification session is no longer active"],
    KYC_STEP_COMPLETION_FAILED: [httpStatus.CONFLICT, "PAN_VERIFICATION_NOT_ACTIVE", "PAN verification session is no longer active"],
  };
  const match = mappings[error?.code || error?.message];
  return match
    ? apiError(match[0], match[1], match[2])
    : apiError(httpStatus.SERVICE_UNAVAILABLE, "KYC_SERVICE_UNAVAILABLE", "KYC service is temporarily unavailable");
}

function mapProviderFailure(error) {
  const providerCode = error?.responseMetadata?.providerErrorCode;
  const mapped = PROVIDER_ERROR_MAP[providerCode];
  if (mapped) return apiError(mapped[0], mapped[1], mapped[2]);

  if (error?.code === "IDTO_TIMEOUT") {
    return apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_TIMEOUT", "PAN verification is temporarily unavailable");
  }
  if (error?.code === "IDTO_CONFIGURATION_ERROR") {
    return apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_CONFIGURATION_ERROR", "PAN verification is temporarily unavailable");
  }
  return apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_UNAVAILABLE", "PAN verification is temporarily unavailable");
}

function mapBusinessError(errorCode) {
  const mapped = PROVIDER_ERROR_MAP[errorCode];
  return mapped
    ? apiError(mapped[0], mapped[1], mapped[2])
    : apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_UNAVAILABLE", "PAN verification is temporarily unavailable");
}

function isValidTrustedAadhaarName(name) {
  return typeof name === "string" &&
    name.trim().length > 0 &&
    name.length <= 100 &&
    !/[\u0000-\u001f\u007f]/.test(name);
}

function createPanService({
  aadhaarModel = digilockerModel,
  model = panModel,
  provider = panProvider,
  validateResponse = validatePanDetailedResponse,
  compareNames = compareFullNames,
} = {}) {
  async function verifyPan(userId, input) {
    const { panNumber } = validatePanVerificationInput(input);

    if (userId === undefined || userId === null || userId === "") {
      throw apiError(httpStatus.UNAUTHORIZED, "UNAUTHORIZED", "Authentication required");
    }

    let aadhaarVerifiedName;
    try {
      aadhaarVerifiedName = await aadhaarModel.getVerifiedAadhaarName(userId);
    } catch (error) {
      throw mapAadhaarLookupError(error);
    }
    if (!isValidTrustedAadhaarName(aadhaarVerifiedName)) {
      throw apiError(
        httpStatus.CONFLICT,
        "AADHAAR_VERIFIED_NAME_UNAVAILABLE",
        "Verified Aadhaar details are unavailable",
      );
    }

    const providerName = provider.providerName || "idto_pan_detailed_v2";
    let attempt;
    try {
      attempt = await model.createPendingVerification(userId, {
        aadhaarVerifiedName,
        providerName,
      });
    } catch (error) {
      throw mapModelError(error);
    }

    try {
      const response = await provider.verifyPanDetailed({
        pan_number: panNumber,
        user_consent: true,
        name: aadhaarVerifiedName,
      });

      if (!response || typeof response !== "object" || Array.isArray(response) || !Object.hasOwn(response, "error_code")) {
        throw apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_INVALID_RESPONSE", "PAN verification is temporarily unavailable");
      }
      if (response.error_code !== null) throw mapBusinessError(response.error_code);

      let verified;
      try {
        verified = validateResponse(response);
      } catch {
        throw apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_INVALID_RESPONSE", "PAN verification is temporarily unavailable");
      }

      if (verified.panNumber !== panNumber) {
        throw apiError(httpStatus.SERVICE_UNAVAILABLE, "PAN_PROVIDER_INVALID_RESPONSE", "PAN verification is temporarily unavailable");
      }

      if (!compareNames(aadhaarVerifiedName, verified.verifiedName)) {
        throw apiError(httpStatus.UNPROCESSABLE_ENTITY, "PAN_NAME_MISMATCH", "The name on PAN does not match the verified Aadhaar name");
      }

      let completion;
      try {
        completion = await model.completeVerification({
          ...attempt,
          userId,
          panNumber: verified.panNumber,
          maskedIdentifier: verified.maskedIdentifier,
          verifiedName: verified.verifiedName,
          aadhaarVerifiedName,
          providerName,
        });
      } catch (error) {
        throw mapModelError(error);
      }

      return {
        status: provider.mode === "mock" ? "development_unverified" : "verified",
        ...(provider.mode === "mock" ? { developmentOnly: true } : {}),
        maskedIdentifier: verified.maskedIdentifier,
        stepNumber: 3,
        steps_completed: completion.steps_completed,
      };
    } catch (error) {
      const failure = error instanceof ApiError ? error : mapProviderFailure(error);
      try {
        await model.failVerification({
          ...attempt,
          userId,
          failureCode: failure.code,
        });
      } catch (failurePersistenceError) {
        const diagnosticCode = /^[A-Z0-9_]{1,80}$/.test(failurePersistenceError?.code || "")
          ? failurePersistenceError.code
          : "DATABASE_ERROR";
        console.error("[AquaPay PAN] failed to persist sanitized attempt status", { code: diagnosticCode });
      }
      throw failure;
    }
  }

  return Object.freeze({ verifyPan });
}

const defaultService = createPanService();

export const verifyPan = defaultService.verifyPan;
export { createPanService, isValidTrustedAadhaarName, mapBusinessError, mapModelError, mapProviderFailure };
export default { verifyPan };
