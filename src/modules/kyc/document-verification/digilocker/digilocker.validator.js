import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";

const CALLBACK_FIELDS = new Set([
  "code",
  "codeVerifier",
  "code_verifier",
  "clientId",
  "state",
]);

function validationError(message, code = "VALIDATION_ERROR") {
  return new ApiError(httpStatus.BAD_REQUEST, message, [], code);
}

function validateConsent(body) {
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    body.consent !== true
  ) {
    throw validationError("Explicit user consent is required", "CONSENT_REQUIRED");
  }
  return { consent: true };
}

function validateCallbackQuery(query) {
  if (!query || typeof query !== "object" || Array.isArray(query)) {
    throw validationError("Invalid DigiLocker callback", "INVALID_CALLBACK");
  }
  const keys = Object.keys(query);
  if (keys.some((key) => !CALLBACK_FIELDS.has(key))) {
    throw validationError("Invalid DigiLocker callback", "INVALID_CALLBACK");
  }

  const hasCamelVerifier = Object.hasOwn(query, "codeVerifier");
  const hasSnakeVerifier = Object.hasOwn(query, "code_verifier");
  if (hasCamelVerifier === hasSnakeVerifier) {
    throw validationError("Invalid DigiLocker callback", "INVALID_CALLBACK");
  }

  const codeVerifier = query[hasCamelVerifier ? "codeVerifier" : "code_verifier"];
  const { code, state } = query;
  if (
    typeof code !== "string" ||
    code.length < 1 ||
    code.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(code) ||
    typeof codeVerifier !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(codeVerifier) ||
    typeof state !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(state) ||
    (Object.hasOwn(query, "clientId") && typeof query.clientId !== "string")
  ) {
    throw validationError("Invalid DigiLocker callback", "INVALID_CALLBACK");
  }

  // The public IDTO V1 guide does not define clientId's callback meaning. Treat it as
  // untrusted optional metadata; it never selects or authenticates the verification.
  return { code, code_verifier: codeVerifier, state };
}

function callbackDiagnostic(query) {
  const isObject = query !== null && typeof query === "object" && !Array.isArray(query);
  const keys = isObject ? Object.keys(query) : [];
  const present = Object.fromEntries(
    [...CALLBACK_FIELDS].map((field) => [field, isObject && Object.hasOwn(query, field)]),
  );
  const invalidFields = [];
  if (present.code && (
    typeof query.code !== "string" ||
    query.code.length < 1 ||
    query.code.length > 512 ||
    /[\u0000-\u001f\u007f]/.test(query.code)
  )) invalidFields.push("code");
  const hasCamelVerifier = present.codeVerifier;
  const hasSnakeVerifier = present.code_verifier;
  const verifierCount = Number(hasCamelVerifier) + Number(hasSnakeVerifier);
  const verifierField = hasCamelVerifier ? "codeVerifier" : "code_verifier";
  if (verifierCount === 1 && (
    typeof query[verifierField] !== "string" ||
    !/^[A-Za-z0-9._~-]{43,128}$/.test(query[verifierField])
  )) invalidFields.push(verifierField);
  if (present.state && (
    typeof query.state !== "string" ||
    !/^[A-Za-z0-9_-]{43}$/.test(query.state)
  )) invalidFields.push("state");
  if (present.clientId && typeof query.clientId !== "string") invalidFields.push("clientId");

  const unexpectedNames = keys
    .filter((key) => !CALLBACK_FIELDS.has(key))
    .map((key) => /^[A-Za-z0-9_.-]{1,64}$/.test(key) ? key : "<invalid-name>");
  const missingFields = ["code", "state"].filter((field) => !present[field]);
  if (verifierCount === 0) missingFields.push("code_verifier");
  const duplicateFields = keys.filter((field) => CALLBACK_FIELDS.has(field) && Array.isArray(query?.[field]));
  if (hasCamelVerifier && hasSnakeVerifier) duplicateFields.push("codeVerifier/code_verifier");
  const outcome = !isObject
    ? "invalid_query_shape"
    : unexpectedNames.length > 0 || missingFields.length > 0 || verifierCount !== 1
      ? "invalid_parameter_set"
      : invalidFields.length > 0 || duplicateFields.length > 0
        ? "invalid_parameter_value"
        : "invalid_callback";

  return {
    outcome,
    parameterNames: keys.map((key) => /^[A-Za-z0-9_.-]{1,64}$/.test(key) ? key : "<invalid-name>"),
    present,
    missingFields,
    unexpectedNames,
    invalidFieldNames: invalidFields,
    duplicateFields,
  };
}

function validateConsentRequest(req, res, next) {
  try {
    req.validatedInitiation = validateConsent(req.body);
    return next();
  } catch (error) {
    return next(error);
  }
}

function validateCallbackRequest(req, res, next) {
  try {
    req.validatedCallback = validateCallbackQuery(req.query);
    return next();
  } catch (error) {
    if (error?.code === "INVALID_CALLBACK" && process.env.NODE_ENV === "development") {
      try {
        const diagnostic = callbackDiagnostic(req.query);
        console.warn("[AquaPay DigiLocker] callback validation rejected", diagnostic);
      } catch {
        // Preserve the original INVALID_CALLBACK response if diagnostics cannot be emitted.
      }
    }
    return next(error);
  }
}

export {
  validateConsent,
  validateCallbackQuery,
  validateConsentRequest,
  validateCallbackRequest,
};

export default { validateConsentRequest, validateCallbackRequest };
