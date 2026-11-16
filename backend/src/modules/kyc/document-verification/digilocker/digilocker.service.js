import { randomUUID } from "node:crypto";
import digilockerProvider from "./digilocker.provider.js";
import digilockerModel from "./digilocker.model.js";
import digilockerStateStore from "./digilockerStateStore.js";
import { safeFailureCode, toPublicError } from "./digilocker.errors.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import structuredLogger from "../../../../utils/logger.js";

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

function modelErrorToApiError(error) {
  const mapping = MODEL_ERRORS[error?.message];
  return mapping
    ? new ApiError(mapping[0], mapping[1], [], error.message)
    : toPublicError(error);
}

function getRedirectUrl(env, provider) {
  if (provider.mode === "mock") {
    const value = env.IDTO_MOCK_BASE_URL?.trim() || `http://127.0.0.1:${Number(env.PORT || 3000)}`;
    let base;
    try { base = new URL(value); } catch { throw new Error("INVALID_REDIRECT_URL"); }
    if (
      base.protocol !== "http:" || !["localhost", "127.0.0.1", "[::1]"].includes(base.hostname) ||
      base.username || base.password || base.pathname !== "/" || base.search || base.hash
    ) throw new Error("INVALID_REDIRECT_URL");
    return new URL("/api/kyc/digilocker/callback", base.origin).toString();
  }

  const value = env.IDTO_REDIRECT_URL?.trim();
  let redirect;
  try { redirect = new URL(value); } catch { throw new Error("INVALID_REDIRECT_URL"); }
  if (redirect.protocol !== "https:" || redirect.username || redirect.password || redirect.search || redirect.hash) {
    throw new Error("INVALID_REDIRECT_URL");
  }
  return redirect.toString();
}

function validateAuthorizationResponse(response, state, documentCode, provider) {
  if (response?.status !== "success" || response?.code !== 1000 || typeof response?.url !== "string") {
    throw new Error("INVALID_AUTHORIZATION_RESPONSE");
  }
  let url;
  try { url = new URL(response.url); } catch { throw new Error("INVALID_AUTHORIZATION_RESPONSE"); }
  const validState = url.searchParams.getAll("state").length === 1 && url.searchParams.get("state") === state;
  const validHost = provider.mode === "mock"
    ? url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) &&
      url.pathname === "/api/kyc/digilocker/mock-authorize" &&
      url.searchParams.getAll("document").length === 1 && url.searchParams.get("document") === documentCode
    : url.protocol === "https:" && url.hostname === "digilocker.idto.ai";
  if (!validState || !validHost || url.username || url.password) throw new Error("INVALID_AUTHORIZATION_RESPONSE");
  return url.toString();
}

function diagnosticValueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

const REFERENCE_EXPIRY_ISO_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?)(Z|[+-]\d{2}:\d{2})?$/i;

function parseReferenceExpiry(value) {
  if (typeof value !== "string") return Number.NaN;
  const match = REFERENCE_EXPIRY_ISO_PATTERN.exec(value);
  if (!match) return Number.NaN;

  // IDTO documents a one-hour reference-key lifetime but does not specify the
  // timezone on expires_at. Treat only a strict timezone-less ISO timestamp as
  // UTC so the result is independent of the AquaPay host timezone. Preserve
  // explicit UTC/offset timestamps as supplied; never add an expiry grace period.
  const normalized = match[2] ? value : `${value}Z`;
  return Date.parse(normalized);
}

function referenceExpiryTimezoneMode(value) {
  if (typeof value !== "string") return "not_applicable";
  const match = REFERENCE_EXPIRY_ISO_PATTERN.exec(value);
  if (!match) return "unrecognized";
  if (!match[2]) return "timezone_less_assumed_utc";
  return /^[Zz]$/.test(match[2]) ? "explicit_utc" : "explicit_offset";
}

function diagnoseReferenceResponse(response, now = Date.now(), { includeTimestampDiagnostics = false } = {}) {
  const statusPresent = response !== null && response !== undefined && Object.hasOwn(Object(response), "status");
  const status = response?.status;
  const statusMatchesAcceptedLiteral = statusPresent && status === "success";
  const referenceKey = response?.reference_key;
  const referenceKeyIsString = typeof referenceKey === "string";
  const referenceKeyLength = referenceKeyIsString ? referenceKey.length : null;
  const referenceKeyNonEmpty = referenceKeyIsString && referenceKey.length > 0;
  const referenceKeyWithinLengthLimit = referenceKeyIsString && referenceKey.length <= 4096;
  const referenceKeyTrimmed = referenceKeyIsString && referenceKey === referenceKey.trim();
  const referenceKeyHasControlCharacters = referenceKeyIsString
    ? /[\u0000-\u001f\u007f]/.test(referenceKey)
    : null;

  const expiresAtPresent = response !== null && response !== undefined && Object.hasOwn(Object(response), "expires_at");
  const expiresAt = response?.expires_at;
  const expiresAtType = expiresAtPresent ? diagnosticValueType(expiresAt) : "missing";
  const expiresAtIsString = typeof expiresAt === "string";
  const parsedExpiresAt = expiresAtPresent && expiresAtIsString ? parseReferenceExpiry(expiresAt) : Number.NaN;
  const expiresAtParses = Number.isFinite(parsedExpiresAt);
  const expiresAtInFuture = expiresAtParses && parsedExpiresAt > now;
  const serverDate = typeof now === "number" ? new Date(now) : null;
  const serverClockValid = serverDate !== null && Number.isFinite(serverDate.getTime());

  let failureReason = "none";
  if (statusPresent && !statusMatchesAcceptedLiteral) failureReason = "status_not_exact_success";
  else if (!referenceKeyIsString) failureReason = "reference_key_wrong_type";
  else if (!referenceKeyNonEmpty) failureReason = "reference_key_empty";
  else if (!referenceKeyWithinLengthLimit) failureReason = "reference_key_too_long";
  else if (!referenceKeyTrimmed) failureReason = "reference_key_surrounding_whitespace";
  else if (referenceKeyHasControlCharacters) failureReason = "reference_key_control_character";
  else if (expiresAtPresent && !expiresAtIsString) failureReason = "expires_at_wrong_type";
  else if (expiresAtPresent && !expiresAtParses) failureReason = "expires_at_unparseable";
  else if (expiresAtPresent && !expiresAtInFuture) failureReason = "expires_at_not_future";

  const diagnostics = {
    valid: failureReason === "none",
    statusPresent,
    statusType: statusPresent ? diagnosticValueType(status) : "missing",
    statusMatchesAcceptedLiteral,
    referenceKeyType: diagnosticValueType(referenceKey),
    referenceKeyLength,
    referenceKeyNonEmpty,
    referenceKeyWithinLengthLimit,
    referenceKeyTrimmed,
    referenceKeyHasControlCharacters,
    expiresAtPresent,
    expiresAtType,
    expiresAtTimezoneMode: expiresAtPresent ? referenceExpiryTimezoneMode(expiresAt) : "missing",
    expiresAtParses: expiresAtPresent ? expiresAtParses : null,
    expiresAtInFuture: expiresAtPresent ? expiresAtInFuture : null,
    failureReason,
  };
  if (includeTimestampDiagnostics) {
    diagnostics.serverTimeUtc = serverClockValid ? serverDate.toISOString() : null;
    diagnostics.parsedExpiresAtUtc = expiresAtParses ? new Date(parsedExpiresAt).toISOString() : null;
    diagnostics.remainingLifetimeSeconds = serverClockValid && expiresAtParses
      ? Number(((parsedExpiresAt - now) / 1000).toFixed(3))
      : null;
    diagnostics.serverClockValid = serverClockValid;
  }
  return diagnostics;
}

function validReferenceResponse(response, now = Date.now()) {
  return diagnoseReferenceResponse(response, now).valid;
}

function assertOptionalProviderSuccess(response) {
  // Some IDTO tenant responses omit a status field. Preserve those documented/observed
  // responses, but never continue when the provider explicitly reports a non-success.
  if (response && Object.hasOwn(response, "status") && response.status !== "success") {
    throw new Error("IDTO_OPERATION_FAILED");
  }
}

function stackLocation(error) {
  if (typeof error?.stack !== "string") return null;
  for (const line of error.stack.split("\n").slice(1)) {
    const match = line.match(/[\\/]?(src[\\/].+?):(\d+):(\d+)\)?\s*$/);
    if (match) return `${match[1].replaceAll("\\", "/")}:${match[2]}:${match[3]}`;
  }
  return null;
}

const DIAGNOSTIC_NAME = /^[A-Za-z_][A-Za-z0-9_.:-]{0,63}$/;
const DIAGNOSTIC_CODE = /^[a-z][a-z0-9_]{0,79}$/;
const DIAGNOSTIC_STATUS = new Set(["success", "failure", "unknown", "missing"]);
const AADHAAR_IDENTIFIER_FORMATS = new Set(["full_12_digits", "masked_last_four", "invalid"]);
const DIAGNOSTIC_NOT_EVALUATED = new Set(["not_applicable", "not_in_xml", "not_evaluated"]);
const MAX_DIAGNOSTIC_CONTENT_BYTES = 2 * 1024 * 1024;

function safeDiagnosticName(value) {
  return typeof value === "string" && DIAGNOSTIC_NAME.test(value) ? value : "[invalid-name]";
}

function safeDiagnosticKey(value, allowPath = false) {
  if (typeof value === "string" && DIAGNOSTIC_NAME.test(value)) return value;
  if (allowPath && typeof value === "string" && value.length <= 192 &&
      /^(?:[A-Za-z_][A-Za-z0-9_.:-]{0,63})(?:\/[A-Za-z_][A-Za-z0-9_.:-]{0,63}){1,8}$/.test(value)) return value;
  return "[invalid-name]";
}

function safeDiagnosticNames(value, max = 24) {
  return Array.isArray(value) ? value.slice(0, max).map(safeDiagnosticName) : [];
}

function safeDiagnosticBooleanOrMarker(value) {
  if (typeof value === "boolean") return value;
  return typeof value === "string" && DIAGNOSTIC_NOT_EVALUATED.has(value) ? value : undefined;
}

function sanitizeDocumentDiagnostics(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const safe = {};
  for (const key of ["validationStage", "documentFormat"]) {
    if (typeof metadata[key] === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(metadata[key])) safe[key] = metadata[key];
  }
  for (const key of ["validationFailureReason", "parserErrorCategory"]) {
    if (typeof metadata[key] === "string" && DIAGNOSTIC_CODE.test(metadata[key])) safe[key] = metadata[key];
  }
  if (Number.isSafeInteger(metadata.contentLengthBytes) && metadata.contentLengthBytes >= 0) {
    safe.contentLengthBytes = Math.min(metadata.contentLengthBytes, MAX_DIAGNOSTIC_CONTENT_BYTES);
  }
  if (typeof metadata.xmlRootElementName === "string") safe.xmlRootElementName = safeDiagnosticName(metadata.xmlRootElementName);
  for (const key of ["xmlNamespacePresent", "xmlRootPrefixPresent", "documentTypeAttributePresent", "documentTypeAttributeLocalNamePresent", "kycResponseErrorAttributePresent", "kycTimestampPresent", "kycTimestampValid", "signatureBypassActive"]) {
    if (typeof metadata[key] === "boolean") safe[key] = metadata[key];
  }
  if (metadata.xmlNamespace !== undefined) safe.xmlNamespacePresent = Boolean(metadata.xmlNamespace);
  if (metadata.documentTypeAttributeNamespace !== undefined) {
    safe.documentTypeAttributeNamespacePresent = Boolean(metadata.documentTypeAttributeNamespace);
  }
  for (const key of ["expectedDocumentTypeMatched", "expectedIssuerPresent"]) {
    const value = safeDiagnosticBooleanOrMarker(metadata[key]);
    if (value !== undefined) safe[key] = value;
  }
  if (DIAGNOSTIC_STATUS.has(metadata.kycResponseStatusClassification)) {
    safe.kycResponseStatusClassification = metadata.kycResponseStatusClassification;
  }
  if (AADHAAR_IDENTIFIER_FORMATS.has(metadata.aadhaarIdentifierFormat)) {
    safe.aadhaarIdentifierFormat = metadata.aadhaarIdentifierFormat;
  }

  for (const key of ["rootAttributeNames"]) {
    if (Array.isArray(metadata[key])) safe[key] = safeDiagnosticNames(metadata[key]);
  }
  if (Array.isArray(metadata.rootChildElements)) {
    safe.rootChildElements = metadata.rootChildElements.slice(0, 16).map((child) => ({
      name: safeDiagnosticName(child?.name),
      ...(typeof child?.namespacePresent === "boolean" ? { namespacePresent: child.namespacePresent } : {}),
      attributeNames: safeDiagnosticNames(child?.attributeNames),
      childElements: safeDiagnosticNames(child?.childElements),
    }));
  }
  for (const key of ["elementCounts", "elementPathsPresent", "elementAttributeNames", "requiredFieldPresence", "optionalFieldPresence", "pullDocResponseChecks"]) {
    const source = metadata[key];
    if (!source || typeof source !== "object" || Array.isArray(source)) continue;
    const output = {};
    for (const [name, value] of Object.entries(source).slice(0, 24)) {
      const safeKey = safeDiagnosticKey(name, key === "elementPathsPresent");
      if (typeof value === "boolean") output[safeKey] = value;
      else if (Number.isSafeInteger(value) && value >= 0) output[safeKey] = Math.min(value, MAX_DIAGNOSTIC_CONTENT_BYTES);
      else if ((key === "requiredFieldPresence" || key === "optionalFieldPresence") && value === "not_evaluated") output[safeKey] = value;
      else if (key === "elementAttributeNames" && Array.isArray(value)) output[safeKey] = safeDiagnosticNames(value);
      else if (key === "pullDocResponseChecks" && typeof value === "string" && DIAGNOSTIC_STATUS.has(value)) output[safeKey] = value;
    }
    safe[key] = output;
  }
  return safe;
}

function createDigilockerService({
  provider = digilockerProvider,
  model = digilockerModel,
  stateStore = digilockerStateStore,
  env = process.env,
  logger = structuredLogger,
} = {}) {
  const handlers = new Map();

  function registerVerificationHandler(verificationType, handler) {
    if (
      typeof verificationType !== "string" || !/^[a-z][a-z0-9_-]{1,31}$/.test(verificationType) ||
      !handler || typeof handler.documentCode !== "string" || !handler.documentCode ||
      typeof handler.issuerId !== "string" || !handler.issuerId ||
      typeof handler.consentPurpose !== "string" || !handler.consentPurpose ||
      !Number.isInteger(handler.stepNumber) || handler.stepNumber < 1 ||
      typeof handler.retrieveDocument !== "function" || typeof handler.verifyAndPersist !== "function"
    ) throw new TypeError("Invalid DigiLocker verification handler");
    handlers.set(verificationType, Object.freeze({ ...handler }));
    return () => handlers.delete(verificationType);
  }

  async function initiateAuthorization(userId, verificationType, { consent } = {}) {
    const handler = handlers.get(verificationType);
    if (!handler) throw new ApiError(httpStatus.BAD_REQUEST, "Unsupported KYC verification type", [], "INVALID_VERIFICATION_TYPE");
    if (consent !== true) throw new ApiError(httpStatus.BAD_REQUEST, "User consent is required", [], "CONSENT_REQUIRED");

    let attempt;
    let authorization;
    try {
      authorization = stateStore.prepareAuthorizationState();
      attempt = await model.createPendingVerification(userId, verificationType, authorization);
      attempt = { ...attempt, digilockerSessionId: authorization.sessionId };
      const providerResponse = await provider.initiateSession({
        consent: true,
        consent_purpose: handler.consentPurpose,
        redirect_url: getRedirectUrl(env, provider),
        redirect_to_signup: false,
        documents_for_consent: [handler.documentCode],
        state: authorization.state,
      });
      const authorizationUrl = validateAuthorizationResponse(providerResponse, authorization.state, handler.documentCode, provider);
      await stateStore.saveInitiationResponse?.(authorization.sessionId, providerResponse);
      return {
        sessionId: authorization.sessionId,
        authorizationUrl,
        status: "PENDING",
        expiresIn: authorization.expiresIn,
        verificationType,
        stepNumber: handler.stepNumber,
      };
    } catch (error) {
      if (authorization?.state) await stateStore.discardAuthorizationState(authorization.state).catch(() => {});
      if (attempt) await model.failVerification({ ...attempt, failureCode: safeFailureCode(error) }).catch(() => {});
      throw modelErrorToApiError(error);
    }
  }

  async function completeCallback({ code, code_verifier: codeVerifier, state }, { correlationId = randomUUID() } = {}) {
    if (
      typeof code !== "string" || !code || code.length > 512 || /[\u0000-\u001f\u007f]/.test(code) ||
      typeof codeVerifier !== "string" || !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier) ||
      typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)
    ) throw new ApiError(httpStatus.BAD_REQUEST, "Invalid DigiLocker callback", [], "INVALID_CALLBACK");

    const diagnostic = { correlationId, stage: "mysql_state_consumption", providerEndpoint: null, responseMetadata: null, documentDiagnostics: null };
    let attempt;
    try { attempt = await stateStore.consumeAuthorizationState(state, { code, codeVerifier }); }
    catch (error) {
      logFailure(logger, env, error, diagnostic);
      throw modelErrorToApiError(error);
    }
    if (!attempt) throw new ApiError(httpStatus.BAD_REQUEST, "DigiLocker authorization state is invalid or expired", [], "INVALID_OR_EXPIRED_STATE");
    const handler = handlers.get(attempt.verificationType);
    if (!handler) {
      await model.failVerification({ ...attempt, failureCode: "UNSUPPORTED_VERIFICATION_TYPE" }).catch(() => {});
      throw new ApiError(httpStatus.BAD_REQUEST, "DigiLocker authorization state is invalid or expired", [], "INVALID_OR_EXPIRED_STATE");
    }

    const reportProviderStage = async (stage, endpoint) => {
      diagnostic.stage = stage;
      diagnostic.providerEndpoint = endpoint;
      diagnostic.responseMetadata = null;
      if (typeof stateStore.setStage === "function") await stateStore.setStage(attempt.digilockerSessionId, endpoint);
    };
    const onResponseMeta = (metadata) => { diagnostic.responseMetadata = metadata; };

    try {
      await reportProviderStage("provider_get_reference", "get_reference");
      const referenceResponse = await provider.getReference(
        { code, code_verifier: codeVerifier },
        env.NODE_ENV === "development" ? { onResponseMeta } : undefined,
      );
      const referenceValidation = diagnoseReferenceResponse(
        referenceResponse,
        Date.now(),
        { includeTimestampDiagnostics: env.NODE_ENV === "development" },
      );
      if (!referenceValidation.valid) {
        if (env.NODE_ENV === "development") diagnostic.referenceValidation = referenceValidation;
        throw new Error("INVALID_REFERENCE_RESPONSE");
      }

      const referenceExpiresAtMs = typeof referenceResponse.expires_at === "string"
        ? parseReferenceExpiry(referenceResponse.expires_at)
        : Number.NaN;
      const normalizedReferenceExpiry = Number.isFinite(referenceExpiresAtMs)
        ? new Date(referenceExpiresAtMs)
        : undefined;
      await stateStore.saveReferenceKey(attempt, referenceResponse.reference_key, normalizedReferenceExpiry);
      const referenceKey = await stateStore.loadReferenceKey(attempt);

      const xml = await handler.retrieveDocument({
        provider,
        referenceKey,
        reportProviderStage,
        onResponseMeta: env.NODE_ENV === "development" ? onResponseMeta : undefined,
      });
      if (typeof xml !== "string" || !xml.trim()) throw new Error("INVALID_DOCUMENT_RESPONSE");

      const { extracted, completion } = await handler.verifyAndPersist({
        attempt,
        xml,
        setDocumentDiagnostics(metadata) {
          diagnostic.documentDiagnostics = sanitizeDocumentDiagnostics(metadata);
        },
        async setDiagnosticStage(stage) {
          if (typeof stage === "string" && /^[a-z][a-z0-9_]{1,80}$/.test(stage)) {
            diagnostic.stage = stage;
            diagnostic.providerEndpoint = null;
            const persistedStage = stage === "aadhaar_xml_validation" ? "aadhaar_validation" :
              stage === "pan_xml_validation" ? "pan_validation" :
                stage.endsWith("_transactional_persistence") ? "persistence" : null;
            if (persistedStage && typeof stateStore.setStage === "function") {
              await stateStore.setStage(attempt.digilockerSessionId, persistedStage);
            }
          }
        },
      });
      if (
        !extracted || typeof extracted.maskedIdentifier !== "string" ||
        typeof extracted.verifiedName !== "string" ||
        (attempt.verificationType === "pan" && (
          typeof extracted.signatureVerified !== "boolean" ||
          extracted.developmentOnly !== !extracted.signatureVerified ||
          extracted.verificationMode !== (extracted.signatureVerified ? "issuer_certificate" : "development_unverified")
        )) ||
        !completion || !Number.isInteger(completion.stepNumber) || !Number.isInteger(completion.steps_completed)
      ) throw new Error("INVALID_VERIFICATION_RESULT");

      const result = {
        verificationType: attempt.verificationType,
        verificationStatus: attempt.verificationType === "pan" && !extracted.signatureVerified
          ? "development_unverified"
          : "verified",
        maskedIdentifier: extracted.maskedIdentifier,
        verifiedName: extracted.verifiedName,
        stepNumber: completion.stepNumber,
        steps_completed: completion.steps_completed,
      };
      if (attempt.verificationType === "pan") {
        result.signatureVerified = extracted.signatureVerified;
        result.developmentOnly = extracted.developmentOnly;
        result.verificationMode = extracted.verificationMode;
      }
      return result;
    } catch (error) {
      logFailure(logger, env, error, diagnostic);
      await model.failVerification({ ...attempt, failureCode: safeFailureCode(error) }).catch((failureError) => {
        logFailure(logger, env, failureError, { ...diagnostic, stage: "verification_failure_recording", providerEndpoint: null });
      });
      throw modelErrorToApiError(error);
    }
  }

  async function getAadhaarSessionStatus(userId, sessionId) {
    let result;
    try { result = await stateStore.getSessionStatus(userId, sessionId); }
    catch {
      throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "KYC service is temporarily unavailable", [], "SERVICE_UNAVAILABLE");
    }
    if (!result) throw new ApiError(httpStatus.NOT_FOUND, "Aadhaar verification session not found", [], "KYC_SESSION_NOT_FOUND");
    return result;
  }

  return { initiateAuthorization, completeCallback, getAadhaarSessionStatus, registerVerificationHandler };
}

function logFailure(logger, env, error, context) {
  logger.error("[AquaPay DigiLocker] callback failure", {
    correlationId: context.correlationId,
    stage: context.stage,
    providerEndpoint: context.providerEndpoint,
    httpStatus: context.responseMetadata?.httpStatus ?? error?.statusCode ?? null,
    errorCode: safeFailureCode(error),
    stackLocation: stackLocation(error),
    contentType: context.responseMetadata?.contentType ?? null,
    responseFormat: context.responseMetadata?.responseFormat ?? null,
    topLevelPropertyNames: context.responseMetadata?.topLevelPropertyNames ?? [],
    topLevelValueTypes: context.responseMetadata?.topLevelValueTypes ?? {},
    expectedFields: context.responseMetadata?.expectedFields ?? {},
    contentLengthBytes: context.responseMetadata?.contentLengthBytes ?? null,
    referenceValidation: context.referenceValidation ?? null,
    documentDiagnostics: sanitizeDocumentDiagnostics(context.documentDiagnostics),
  });
}

const defaultService = createDigilockerService();
export const initiateAuthorization = defaultService.initiateAuthorization;
export const completeCallback = defaultService.completeCallback;
export const getAadhaarSessionStatus = defaultService.getAadhaarSessionStatus;
export const registerVerificationHandler = defaultService.registerVerificationHandler;
export { createDigilockerService, diagnoseReferenceResponse, validReferenceResponse };
export default { initiateAuthorization, completeCallback, getAadhaarSessionStatus, registerVerificationHandler };
