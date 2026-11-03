import { randomUUID } from "node:crypto";
import digilockerProvider from "./digilocker.provider.js";
import digilockerModel from "./digilocker.model.js";
import digilockerStateStore from "./digilockerStateStore.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";

const MODEL_ERRORS = Object.freeze({
  USER_NOT_ACTIVE: [httpStatus.UNAUTHORIZED, "Invalid or inactive user"],
  KYC_CASE_NOT_FOUND: [httpStatus.NOT_FOUND, "KYC case was not initialized for this user"],
  KYC_CASE_AMBIGUOUS: [httpStatus.CONFLICT, "Multiple KYC cases exist for this user"],
  KYC_CASE_NOT_EDITABLE: [httpStatus.CONFLICT, "KYC case is not available for verification"],
  KYC_PREREQUISITE_NOT_COMPLETED: [httpStatus.CONFLICT, "Complete the previous KYC step first"],
  KYC_STEP_NOT_INITIALIZED: [httpStatus.CONFLICT, "KYC verification step is not initialized"],
  VERIFICATION_ALREADY_COMPLETED: [httpStatus.CONFLICT, "This verification is already completed"],
  VERIFICATION_IN_PROGRESS: [httpStatus.CONFLICT, "A verification session is already in progress"],
  VERIFICATION_SESSION_NOT_FOUND: [httpStatus.CONFLICT, "Verification session is no longer available"],
  VERIFICATION_SESSION_NOT_ACTIVE: [httpStatus.CONFLICT, "Verification session is no longer active"],
});

function apiError(statusCode, message, code) {
  return new ApiError(statusCode, message, [], code);
}

function serviceUnavailable() {
  return apiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "DigiLocker verification is temporarily unavailable",
    "DIGILOCKER_UNAVAILABLE",
  );
}

function mapError(error) {
  if (error instanceof ApiError) return error;

  const modelError = MODEL_ERRORS[error?.message];
  if (modelError) {
    const [statusCode, message] = modelError;
    return apiError(statusCode, message, error.message);
  }
  if (error?.message === "REQUIRED_DOCUMENT_NOT_FOUND") {
    return apiError(httpStatus.UNPROCESSABLE_ENTITY, "The required DigiLocker document was not found", "DOCUMENT_NOT_FOUND");
  }
  if (error?.message === "AMBIGUOUS_REQUIRED_DOCUMENT") {
    return apiError(httpStatus.UNPROCESSABLE_ENTITY, "DigiLocker returned multiple matching documents", "DOCUMENT_AMBIGUOUS");
  }
  if (error?.code === "SIGNING_CERTIFICATE_NOT_CONFIGURED") return serviceUnavailable();
  if (error?.code === "INVALID_DOCUMENT_SIGNATURE" || error?.code?.startsWith("INVALID_") && error?.code?.endsWith("_DOCUMENT")) {
    return apiError(
      httpStatus.UNPROCESSABLE_ENTITY,
      "DigiLocker returned a document that could not be verified",
      "INVALID_VERIFICATION_DOCUMENT",
    );
  }
  return serviceUnavailable();
}

function mapErrorPreservingCause(error) {
  const mapped = mapError(error);
  if (mapped !== error && mapped.cause === undefined) mapped.cause = error;
  return mapped;
}

function getRedirectUrl(env, provider) {
  if (provider.mode === "mock") {
    const configuredBase = env.IDTO_MOCK_BASE_URL?.trim() || `http://127.0.0.1:${Number(env.PORT || 3000)}`;
    let mockBaseUrl;
    try {
      mockBaseUrl = new URL(configuredBase);
    } catch {
      throw new Error("Mock provider base URL is not configured correctly");
    }
    if (
      mockBaseUrl.protocol !== "http:" ||
      !["localhost", "127.0.0.1", "[::1]"].includes(mockBaseUrl.hostname) ||
      mockBaseUrl.username ||
      mockBaseUrl.password ||
      mockBaseUrl.pathname !== "/" ||
      mockBaseUrl.search ||
      mockBaseUrl.hash
    ) {
      throw new Error("Mock provider must use a local loopback URL");
    }
    return new URL("/api/kyc/digilocker/callback", mockBaseUrl.origin).toString();
  }

  const value = env.IDTO_REDIRECT_URL?.trim();
  if (!value) throw new Error("IDTO redirect URL is not configured");
  let redirectUrl;
  try {
    redirectUrl = new URL(value);
  } catch {
    throw new Error("IDTO redirect URL is not configured");
  }
  if (
    redirectUrl.protocol !== "https:" ||
    redirectUrl.username ||
    redirectUrl.password ||
    redirectUrl.search ||
    redirectUrl.hash
  ) {
    throw new Error("IDTO redirect URL is not configured");
  }
  return redirectUrl.toString();
}

function validateAuthorizationUrl(response, state, documentCode, provider) {
  if (response?.status !== "success" || response?.code !== 1000 || typeof response?.url !== "string") {
    throw new Error("INVALID_AUTHORIZATION_RESPONSE");
  }
  let url;
  try {
    url = new URL(response.url);
  } catch {
    throw new Error("INVALID_AUTHORIZATION_RESPONSE");
  }
  const validSharedFields =
    !url.username &&
    !url.password &&
    url.searchParams.getAll("state").length === 1 &&
    url.searchParams.get("state") === state;
  const validProviderUrl = provider.mode === "mock"
    ? url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/api/kyc/digilocker/mock-authorize" &&
      url.searchParams.getAll("document").length === 1 &&
      url.searchParams.get("document") === documentCode
    : url.protocol === "https:" && url.hostname === "digilocker.idto.ai";
  if (!validSharedFields || !validProviderUrl) throw new Error("INVALID_AUTHORIZATION_RESPONSE");
  return url.toString();
}

function validReferenceResponse(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) return false;
  const referenceKey = response.reference_key;
  return typeof referenceKey === "string" &&
    referenceKey.length > 0 &&
    referenceKey.length <= 4096 &&
    referenceKey === referenceKey.trim() &&
    !/[\u0000-\u001f\u007f]/.test(referenceKey);
}

function selectIssuedDocument(response, { documentCode, issuerId }) {
  if (
    typeof documentCode !== "string" || !documentCode ||
    typeof issuerId !== "string" || !issuerId ||
    response?.status !== "success" ||
    !Array.isArray(response?.issued_docs?.items)
  ) throw new Error("INVALID_ISSUED_DOCS_RESPONSE");

  const candidates = response.issued_docs.items.filter((item) =>
    item &&
    item.type === "file" &&
    item.doctype === documentCode &&
    item.issuerid === issuerId &&
    typeof item.uri === "string" &&
    item.uri.length > 0 &&
    item.uri.length <= 2048 &&
    !/[\u0000-\u001f\u007f]/.test(item.uri) &&
    (!Object.hasOwn(item, "mime") ||
      (Array.isArray(item.mime) && item.mime.includes("application/xml"))),
  );
  if (candidates.length !== 1) {
    throw new Error(candidates.length === 0 ? "REQUIRED_DOCUMENT_NOT_FOUND" : "AMBIGUOUS_REQUIRED_DOCUMENT");
  }
  return candidates[0];
}

function getFailureCode(error) {
  if (typeof error?.code === "string" && /^[A-Z0-9_]{1,100}$/.test(error.code)) return error.code;
  if (error?.message === "REQUIRED_DOCUMENT_NOT_FOUND") return "DOCUMENT_NOT_FOUND";
  if (error?.message === "AMBIGUOUS_REQUIRED_DOCUMENT") return "DOCUMENT_AMBIGUOUS";
  if (error?.message?.startsWith("INVALID_")) return "INVALID_PROVIDER_RESPONSE";
  return "DIGILOCKER_PROVIDER_ERROR";
}

function getStackLocation(error) {
  if (typeof error?.stack !== "string") return null;
  for (const line of error.stack.split("\n").slice(1)) {
    const match = line.match(/[\\/]?(src[\\/].+?):(\d+):(\d+)\)?\s*$/);
    if (match) return `${match[1].replaceAll("\\", "/")}:${match[2]}:${match[3]}`;
  }
  return null;
}

function getSanitizedErrorMessage(error, stage) {
  const code = getDiagnosticErrorCode(error);
  if (code === "IDTO_HTTP_ERROR") return "IDTO returned a non-success HTTP status";
  if (code === "IDTO_TIMEOUT") return "IDTO request timed out";
  if (code === "IDTO_NETWORK_ERROR") return "IDTO network request failed";
  if (code === "IDTO_CONFIGURATION_ERROR") return "IDTO provider configuration is unavailable";
  if (code === "IDTO_INVALID_RESPONSE" || code === "INVALID_REFERENCE_RESPONSE" || code === "INVALID_ISSUED_DOCS_RESPONSE" || code === "INVALID_DOCUMENT_RESPONSE") {
    return "IDTO returned an invalid response";
  }
  if (code === "INVALID_AADHAAR_DOCUMENT" || code === "INVALID_PAN_DOCUMENT") return "Identity document validation failed";
  if (code === "INVALID_DOCUMENT_SIGNATURE") return "Document signature validation failed";
  if (code === "SIGNING_CERTIFICATE_NOT_CONFIGURED") return "Issuer signing certificate is unavailable";
  if (typeof code === "string" && code.startsWith("ER_")) return "Database operation failed";
  if (stage === "redis_state_consumption") return "Redis authorization-state operation failed";
  if (stage.endsWith("transactional_persistence")) return "Verification persistence failed";
  return "DigiLocker callback operation failed";
}

function getDiagnosticErrorCode(error) {
  const rawCode = typeof error?.code === "string" ? error.code : null;
  if (rawCode && /^[A-Z0-9_]{1,100}$/.test(rawCode)) return rawCode;
  const safeMessageCode = typeof error?.message === "string" ? error.message : "";
  if (
    safeMessageCode === "REQUIRED_DOCUMENT_NOT_FOUND" ||
    safeMessageCode === "AMBIGUOUS_REQUIRED_DOCUMENT" ||
    /^INVALID_[A-Z0-9_]{1,90}$/.test(safeMessageCode)
  ) return safeMessageCode;
  return "UNKNOWN_ERROR";
}

function logCallbackFailure(logger, env, error, context) {
  if (env.NODE_ENV !== "development") return;
  const responseMetadata = context.responseMetadata || error?.responseMetadata || null;
  const status = Number.isInteger(responseMetadata?.httpStatus)
    ? responseMetadata.httpStatus
    : Number.isInteger(error?.statusCode)
      ? error.statusCode
      : Number.isInteger(error?.status) ? error.status : null;

  logger.error("[AquaPay DigiLocker] callback failure", {
    correlationId: context.correlationId,
    stage: context.stage,
    providerEndpoint: context.providerEndpoint,
    httpStatus: status,
    errorCode: getDiagnosticErrorCode(error),
    errorMessage: getSanitizedErrorMessage(error, context.stage),
    stackLocation: getStackLocation(error),
    contentType: responseMetadata?.contentType ?? null,
    responseFormat: responseMetadata?.responseFormat ?? "unavailable",
    jsonRootType: responseMetadata?.jsonRootType ?? null,
    topLevelPropertyNames: responseMetadata?.topLevelPropertyNames ?? [],
    topLevelValueTypes: responseMetadata?.topLevelValueTypes ?? {},
    expectedFields: responseMetadata?.expectedFields ?? {},
    providerErrorCode: responseMetadata?.providerErrorCode ?? null,
    documentFormat: context.documentDiagnostics?.documentFormat ?? null,
    providerDocumentFormat: context.documentDiagnostics?.providerDocumentFormat ?? null,
    providerXmlRootElementName: context.documentDiagnostics?.providerXmlRootElementName ?? null,
    providerXmlNamespace: context.documentDiagnostics?.providerXmlNamespace ?? null,
    xmlRootElementName: context.documentDiagnostics?.xmlRootElementName ?? null,
    xmlNamespace: context.documentDiagnostics?.xmlNamespace ?? null,
    xmlRootPrefixPresent: context.documentDiagnostics?.xmlRootPrefixPresent ?? null,
    documentTypeAttributePresent: context.documentDiagnostics?.documentTypeAttributePresent ?? null,
    documentTypeAttributeLocalNamePresent: context.documentDiagnostics?.documentTypeAttributeLocalNamePresent ?? null,
    documentTypeAttributeNamespace: context.documentDiagnostics?.documentTypeAttributeNamespace ?? null,
    expectedDocumentTypeMatched: context.documentDiagnostics?.expectedDocumentTypeMatched ?? null,
    expectedIssuerPresent: context.documentDiagnostics?.expectedIssuerPresent ?? "not_evaluated",
    requiredFieldPresence: context.documentDiagnostics?.requiredFieldPresence ?? { status: "not_evaluated" },
    pullDocResponseChecks: context.documentDiagnostics?.pullDocResponseChecks ?? null,
    validationFailureReason: context.documentDiagnostics?.validationFailureReason ?? null,
    signatureBypassActive: context.documentDiagnostics?.signatureBypassActive ?? null,
  });
}

function createDigilockerService({
  provider = digilockerProvider,
  model = digilockerModel,
  stateStore = digilockerStateStore,
  env = process.env,
  logger = console,
} = {}) {
  const handlers = new Map();

  function registerVerificationHandler(verificationType, handler) {
    if (
      typeof verificationType !== "string" || !/^[a-z][a-z0-9_-]{1,31}$/.test(verificationType) ||
      !handler ||
      typeof handler.documentCode !== "string" || !handler.documentCode ||
      typeof handler.issuerId !== "string" || !handler.issuerId ||
      typeof handler.consentPurpose !== "string" || !handler.consentPurpose ||
      !Number.isInteger(handler.stepNumber) || handler.stepNumber < 1 ||
      typeof handler.verifyAndPersist !== "function"
    ) throw new TypeError("Invalid DigiLocker verification handler");

    handlers.set(verificationType, Object.freeze({ ...handler }));
    return () => handlers.delete(verificationType);
  }

  async function getDocumentMaster() {
    try {
      return await provider.getDocumentMaster();
    } catch {
      throw serviceUnavailable();
    }
  }

  async function initiateAuthorization(userId, verificationType, { consent } = {}) {
    const handler = handlers.get(verificationType);
    if (!handler) {
      throw apiError(httpStatus.BAD_REQUEST, "Unsupported KYC verification type", "INVALID_VERIFICATION_TYPE");
    }
    if (consent !== true) {
      throw apiError(httpStatus.BAD_REQUEST, "User consent is required", "CONSENT_REQUIRED");
    }

    let attempt;
    try {
      attempt = await model.createPendingVerification(userId, verificationType);
    } catch (error) {
      throw mapError(error);
    }

    let authorization;
    try {
      authorization = await stateStore.createAuthorizationState({
        userId: attempt.userId,
        caseId: attempt.caseId,
        verificationId: attempt.verificationId,
        authorizationSessionId: attempt.authorizationSessionId,
        verificationType,
      });
      const providerResponse = await provider.initiateSession({
        consent: true,
        consent_purpose: handler.consentPurpose,
        redirect_url: getRedirectUrl(env, provider),
        redirect_to_signup: false,
        documents_for_consent: [handler.documentCode],
        state: authorization.state,
      });
      const authorizationUrl = validateAuthorizationUrl(
        providerResponse,
        authorization.state,
        handler.documentCode,
        provider,
      );
      return {
        authorizationUrl,
        expiresIn: authorization.expiresIn,
        verificationType,
        stepNumber: handler.stepNumber,
      };
    } catch (error) {
      if (authorization?.state) await stateStore.discardAuthorizationState(authorization.state).catch(() => {});
      await model.failVerification({ ...attempt, failureCode: getFailureCode(error) }).catch(() => {});
      throw mapError(error);
    }
  }

  async function completeCallback({ code, code_verifier, state }, { correlationId = randomUUID() } = {}) {
    const diagnostic = {
      correlationId,
      stage: "redis_state_consumption",
      providerEndpoint: null,
    };
    let attempt;
    try {
      attempt = await stateStore.consumeAuthorizationState(state);
    } catch (error) {
      logCallbackFailure(logger, env, error, diagnostic);
      throw mapErrorPreservingCause(error);
    }
    if (!attempt) {
      throw apiError(httpStatus.BAD_REQUEST, "DigiLocker authorization state is invalid or expired", "INVALID_OR_EXPIRED_STATE");
    }
    const handler = handlers.get(attempt.verificationType);
    if (!handler) {
      await model.failVerification({ ...attempt, failureCode: "UNSUPPORTED_VERIFICATION_TYPE" }).catch(() => {});
      throw apiError(httpStatus.BAD_REQUEST, "DigiLocker authorization state is invalid or expired", "INVALID_OR_EXPIRED_STATE");
    }

    try {
      diagnostic.stage = "provider_get_reference";
      diagnostic.providerEndpoint = "get_reference";
      const referenceResponse = await provider.getReference(
        { code, code_verifier },
        env.NODE_ENV === "development"
          ? { onResponseMeta: (metadata) => { diagnostic.responseMetadata = metadata; } }
          : undefined,
      );
      if (!validReferenceResponse(referenceResponse)) throw new Error("INVALID_REFERENCE_RESPONSE");
      // Aadhaar: fetch user details and the signed Aadhaar XML.
if (attempt.verificationType === "aadhaar") {
  diagnostic.stage = "provider_user_details";
  diagnostic.providerEndpoint = "user_details";
  diagnostic.responseMetadata = null;

  const userDetails = await provider.getUserDetails(
  { reference_key: referenceResponse.reference_key },
  env.NODE_ENV === "development"
    ? {
        onResponseMeta: (metadata) => {
          diagnostic.responseMetadata = metadata;
        },
      }
    : undefined,
);

if (env.NODE_ENV === "development") {
  console.dir(userDetails, { depth: null, colors: true });
}

  diagnostic.stage = "provider_fetch_aadhaar";
  diagnostic.providerEndpoint = "fetch_aadhaar";
  diagnostic.responseMetadata = null;

  const xml = await provider.fetchAadhaar(
    { reference_key: referenceResponse.reference_key },
    env.NODE_ENV === "development"
      ? {
          onResponseMeta: (metadata) => {
            diagnostic.responseMetadata = metadata;
          },
        }
      : undefined,
  );

  if (typeof xml !== "string" || !xml.trim()) {
    throw new Error("INVALID_DOCUMENT_RESPONSE");
  }

  diagnostic.stage = "aadhaar_transactional_persistence";

  const { extracted, completion } = await handler.verifyAndPersist({
    attempt,
    userDetails,
    xml,
    setDiagnosticStage(stage) {
      if (
        typeof stage === "string" &&
        /^[a-z][a-z0-9_]{1,80}$/.test(stage)
      ) {
        diagnostic.stage = stage;

        if (stage.endsWith("_transactional_persistence")) {
          diagnostic.providerEndpoint = null;
        }
      }
    },
    setDocumentDiagnostics(metadata) {
      if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
        diagnostic.documentDiagnostics = {
          ...(diagnostic.documentDiagnostics || {}),
          ...metadata,
        };
      }
    },
  });

  if (
    !extracted ||
    typeof extracted.verifiedName !== "string" ||
    !extracted.verifiedName.trim() ||
    typeof extracted.maskedIdentifier !== "string" ||
    typeof extracted.signatureVerified !== "boolean" ||
    extracted.developmentOnly !== !extracted.signatureVerified ||
    extracted.verificationMode !==
      (extracted.signatureVerified
        ? "issuer_certificate"
        : "development_unverified") ||
    !completion ||
    !Number.isInteger(completion.stepNumber) ||
    !Number.isInteger(completion.steps_completed)
  ) {
    throw new Error("INVALID_VERIFICATION_RESULT");
  }

  return {
    verificationType: attempt.verificationType,
    verificationStatus: extracted.signatureVerified
      ? "verified"
      : "development_unverified",
    signatureVerified: extracted.signatureVerified,
    developmentOnly: extracted.developmentOnly,
    verificationMode: extracted.verificationMode,
    maskedIdentifier: extracted.maskedIdentifier,
    verifiedName: extracted.verifiedName,
    stepNumber: completion.stepNumber,
    steps_completed: completion.steps_completed,
  };
}
      diagnostic.stage = "provider_issued_docs";
      diagnostic.providerEndpoint = "issued_docs";
      diagnostic.responseMetadata = null;
      const documentResponse = await provider.getIssuedDocs(
        { reference_key: referenceResponse.reference_key },
        env.NODE_ENV === "development"
          ? { onResponseMeta: (metadata) => { diagnostic.responseMetadata = metadata; } }
          : undefined,
      );
      const document = selectIssuedDocument(documentResponse, handler);
      diagnostic.stage = "provider_get_issued_docs_xml";
      diagnostic.providerEndpoint = "get_issued_docs_xml";
      diagnostic.responseMetadata = null;
      diagnostic.documentDiagnostics = null;
      const xml = await provider.getIssuedDocsXml(
        {
          reference_key: referenceResponse.reference_key,
          uri: document.uri,
        },
        env.NODE_ENV === "development"
          ? { onResponseMeta: (metadata) => { diagnostic.responseMetadata = metadata; } }
          : undefined,
      );
      if (typeof xml !== "string" || !xml.trim()) throw new Error("INVALID_DOCUMENT_RESPONSE");

      diagnostic.stage = `${attempt.verificationType}_transactional_persistence`;
      const { extracted, completion } = await handler.verifyAndPersist({
        attempt,
        xml,
        setDiagnosticStage(stage) {
          if (typeof stage === "string" && /^[a-z][a-z0-9_]{1,80}$/.test(stage)) {
            diagnostic.stage = stage;
            if (stage.endsWith("_transactional_persistence")) diagnostic.providerEndpoint = null;
          }
        },
        setDocumentDiagnostics(metadata) {
          if (metadata && typeof metadata === "object" && !Array.isArray(metadata)) {
            const current = diagnostic.documentDiagnostics || {};
            const merged = { ...current, ...metadata };
            if (
              metadata.expectedIssuerPresent === "not_evaluated" &&
              current.expectedIssuerPresent !== undefined
            ) merged.expectedIssuerPresent = current.expectedIssuerPresent;
            if (
              metadata.requiredFieldPresence?.status === "not_evaluated" &&
              current.requiredFieldPresence &&
              !Object.hasOwn(current.requiredFieldPresence, "status")
            ) merged.requiredFieldPresence = current.requiredFieldPresence;
            diagnostic.documentDiagnostics = merged;
          }
        },
      });
      if (
        !extracted ||
        typeof extracted.maskedIdentifier !== "string" ||
        typeof extracted.verifiedName !== "string" ||
        typeof extracted.signatureVerified !== "boolean" ||
        extracted.developmentOnly !== !extracted.signatureVerified ||
        extracted.verificationMode !== (extracted.signatureVerified ? "issuer_certificate" : "development_unverified") ||
        !completion ||
        !Number.isInteger(completion.stepNumber) ||
        !Number.isInteger(completion.steps_completed)
      ) throw new Error("INVALID_VERIFICATION_RESULT");

      return {
        verificationType: attempt.verificationType,
        verificationStatus: extracted.signatureVerified ? "verified" : "development_unverified",
        signatureVerified: extracted.signatureVerified,
        developmentOnly: extracted.developmentOnly,
        verificationMode: extracted.verificationMode,
        maskedIdentifier: extracted.maskedIdentifier,
        verifiedName: extracted.verifiedName,
        stepNumber: completion.stepNumber,
        steps_completed: completion.steps_completed,
      };
    } catch (error) {
      logCallbackFailure(logger, env, error, diagnostic);
      try {
        diagnostic.stage = "verification_failure_recording";
        await model.failVerification({ ...attempt, failureCode: getFailureCode(error) });
      } catch (failureError) {
        logCallbackFailure(logger, env, failureError, diagnostic);
      }
      throw mapErrorPreservingCause(error);
    }
  }

  return { getDocumentMaster, initiateAuthorization, completeCallback, registerVerificationHandler };
}

const defaultService = createDigilockerService();

export const getDocumentMaster = defaultService.getDocumentMaster;
export const initiateAuthorization = defaultService.initiateAuthorization;
export const completeCallback = defaultService.completeCallback;
export const registerVerificationHandler = defaultService.registerVerificationHandler;
export {
  createDigilockerService,
  mapError,
  selectIssuedDocument,
  validReferenceResponse,
};
export default {
  getDocumentMaster,
  initiateAuthorization,
  completeCallback,
  registerVerificationHandler,
};
