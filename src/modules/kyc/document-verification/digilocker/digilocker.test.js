import "../../../auth/setupEnv.js";
import assert from "node:assert/strict";
import { test } from "node:test";
import ApiError from "../../../../utils/ApiError.js";
import { errorHandler } from "../../../../middlewares/error.middleware.js";
import {
  createDigilockerStateStore,
} from "./digilockerStateStore.js";
import {
  createDigilockerProvider,
  ENDPOINTS,
} from "./digilocker.provider.js";
import {
  createDigilockerModel,
  DEVELOPMENT_UNVERIFIED_PROVIDER_NAME,
  getAuthorizationSessionReference,
} from "./digilocker.model.js";
import {
  createDigilockerService,
  selectIssuedDocument,
  validReferenceResponse,
} from "./digilocker.service.js";
import { getDigiLockerSignaturePolicy } from "./digilocker.signatureConfig.js";
import {
  validateCallbackQuery,
  validateCallbackRequest,
  validateConsent,
} from "./digilocker.validator.js";

const TEST_STATE_CONTEXT = Object.freeze({
  userId: "7",
  caseId: "11",
  verificationId: "23",
  authorizationSessionId: "a".repeat(43),
  verificationType: "aadhaar",
});
const MODEL_AUTHORIZATION_SESSION_ID = "t".repeat(43);
const MODEL_SESSION_REFERENCE = getAuthorizationSessionReference(MODEL_AUTHORIZATION_SESSION_ID);
function createModelForHarness(harness, env = { NODE_ENV: "test" }) {
  return createDigilockerModel({ dbPool: harness.pool, env });
}
process.env.NODE_ENV = "test";
process.env.IDTO_PROVIDER_MODE = "idto";
process.env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION = "false";

class FakeRedis {
  constructor(clock) {
    this.clock = clock;
    this.values = new Map();
  }

  async set(key, value, { EX, NX }) {
    if (NX && this.values.has(key)) return null;
    this.values.set(key, { value, expiresAt: this.clock() + EX * 1000 });
    return "OK";
  }

  async eval(_script, { keys }) {
    const entry = this.values.get(keys[0]);
    if (!entry || entry.expiresAt <= this.clock()) {
      this.values.delete(keys[0]);
      return false;
    }
    this.values.delete(keys[0]);
    return entry.value;
  }

  async del(key) {
    return this.values.delete(key) ? 1 : 0;
  }
}

test("authorization state is random, bound, single use, and expires", async () => {
  let currentTime = 1_800_000_000_000;
  const redis = new FakeRedis(() => currentTime);
  const store = createDigilockerStateStore({
    getRedisClient: async () => redis,
    now: () => currentTime,
    ttlSeconds: 600,
  });

  const created = await store.createAuthorizationState(TEST_STATE_CONTEXT);
  assert.match(created.state, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(created.expiresIn, 600);
  assert.equal("codeVerifier" in created, false);
  assert.equal([...redis.values.keys()][0].includes(created.state), false);

  const consumed = await store.consumeAuthorizationState(created.state);
  assert.deepEqual(
    {
      userId: consumed.userId,
      caseId: consumed.caseId,
      verificationId: consumed.verificationId,
      authorizationSessionId: consumed.authorizationSessionId,
      verificationType: consumed.verificationType,
    },
    TEST_STATE_CONTEXT,
  );
  assert.equal(await store.consumeAuthorizationState(created.state), null);

  const expiring = await store.createAuthorizationState(TEST_STATE_CONTEXT);
  currentTime += 601_000;
  assert.equal(await store.consumeAuthorizationState(expiring.state), null);

  const concurrent = await store.createAuthorizationState(TEST_STATE_CONTEXT);
  const parallelConsumption = await Promise.all([
    store.consumeAuthorizationState(concurrent.state),
    store.consumeAuthorizationState(concurrent.state),
  ]);
  assert.equal(parallelConsumption.filter(Boolean).length, 1);
});

test("invalid authorization state and callback parameters are rejected", async () => {
  const store = createDigilockerStateStore({ getRedisClient: async () => new FakeRedis(Date.now) });
  assert.equal(await store.consumeAuthorizationState("short"), null);

  assert.throws(() => validateCallbackQuery({ code: "x", state: "bad" }), /Invalid DigiLocker callback/);
  assert.throws(() => validateCallbackQuery({
    code: ["duplicate"],
    code_verifier: "x".repeat(43),
    state: "s".repeat(43),
  }), /Invalid DigiLocker callback/);
  assert.throws(() => validateConsent({ consent: false }), /Explicit user consent/);
  assert.deepEqual(validateConsent({ consent: true }), { consent: true });
});

test("IDTO camelCase callback verifier normalizes to snake_case and discards an unrecognized clientId", () => {
  const actualCallback = validateCallbackQuery({
    code: "idto-authorization-code",
    codeVerifier: "v".repeat(43),
    clientId: "unrecognized-client-id",
    state: "s".repeat(43),
  });
  assert.deepEqual(actualCallback, {
    code: "idto-authorization-code",
    code_verifier: "v".repeat(43),
    state: "s".repeat(43),
  });
  assert.equal(Object.hasOwn(actualCallback, "clientId"), false);
});

test("callback middleware supplies normalized internal fields to the controller", () => {
  const req = {
    query: {
      code: "idto-authorization-code",
      codeVerifier: "v".repeat(43),
      clientId: "unrecognized-client-id",
      state: "s".repeat(43),
    },
  };
  let forwardedError;
  validateCallbackRequest(req, {}, (error) => { forwardedError = error; });
  assert.equal(forwardedError, undefined);
  assert.deepEqual(req.validatedCallback, {
    code: "idto-authorization-code",
    code_verifier: "v".repeat(43),
    state: "s".repeat(43),
  });
});

test("existing snake_case callback representation remains accepted", () => {
  assert.deepEqual(validateCallbackQuery({
    code: "internal-authorization-code",
    code_verifier: "v".repeat(43),
    state: "s".repeat(43),
  }), {
    code: "internal-authorization-code",
    code_verifier: "v".repeat(43),
    state: "s".repeat(43),
  });
});

test("callback requires a verifier and rejects simultaneous verifier aliases", () => {
  const base = { code: "authorization-code", state: "s".repeat(43) };
  assert.throws(() => validateCallbackQuery(base), /Invalid DigiLocker callback/);
  assert.throws(() => validateCallbackQuery({
    ...base,
    codeVerifier: "v".repeat(43),
    code_verifier: "w".repeat(43),
  }), /Invalid DigiLocker callback/);
});

test("callback rejects invalid state and unknown client identifier field names", () => {
  assert.throws(() => validateCallbackQuery({
    code: "authorization-code",
    codeVerifier: "v".repeat(43),
    state: "invalid-state",
  }), /Invalid DigiLocker callback/);
  assert.throws(() => validateCallbackQuery({
    code: "authorization-code",
    codeVerifier: "v".repeat(43),
    client_id: "untrusted-client-id",
    state: "s".repeat(43),
  }), /Invalid DigiLocker callback/);
});

test("clientId is optional untrusted metadata and duplicate query values are rejected", () => {
  assert.throws(() => validateCallbackQuery({
    code: "authorization-code",
    codeVerifier: "v".repeat(43),
    clientId: ["client-a", "client-b"],
    state: "s".repeat(43),
  }), /Invalid DigiLocker callback/);
});

test("callback rejects expired or already-consumed state before calling IDTO", async () => {
  let providerCalls = 0;
  const service = createDigilockerService({
    provider: { async getReference() { providerCalls += 1; } },
    model: { async failVerification() { assert.fail("invalid state must not change verification status"); } },
    stateStore: { async consumeAuthorizationState() { return null; } },
  });
  await assert.rejects(
    service.completeCallback({ code: "authorization-code", code_verifier: "v".repeat(43), state: "s".repeat(43) }),
    (error) => error.code === "INVALID_OR_EXPIRED_STATE",
  );
  assert.equal(providerCalls, 0);
});

test("Redis callback-state failures are diagnosed safely and mapped to 503", async () => {
  const diagnostics = [];
  const service = createDigilockerService({
    env: { NODE_ENV: "development" },
    logger: { error: (...args) => diagnostics.push(args) },
    stateStore: {
      async consumeAuthorizationState() {
        throw new Error("Redis connection includes private state material");
      },
    },
  });

  await assert.rejects(
    service.completeCallback(
      { code: "authorization-code", code_verifier: "v".repeat(43), state: "s".repeat(43) },
      { correlationId: "correlation-test-redis" },
    ),
    (error) => error.statusCode === 503 && error.code === "DIGILOCKER_UNAVAILABLE",
  );
  assert.equal(diagnostics.length, 1);
  assert.deepEqual(diagnostics[0][1], {
    correlationId: "correlation-test-redis",
    stage: "redis_state_consumption",
    providerEndpoint: null,
    httpStatus: null,
    errorCode: "UNKNOWN_ERROR",
    errorMessage: "Redis authorization-state operation failed",
    stackLocation: diagnostics[0][1].stackLocation,
    contentType: null,
    responseFormat: "unavailable",
    jsonRootType: null,
    topLevelPropertyNames: [],
    topLevelValueTypes: {},
    expectedFields: {},
    providerErrorCode: null,
    documentFormat: null,
    providerDocumentFormat: null,
    providerXmlRootElementName: null,
    providerXmlNamespace: null,
    xmlRootElementName: null,
    xmlNamespace: null,
    xmlRootPrefixPresent: null,
    documentTypeAttributePresent: null,
    documentTypeAttributeLocalNamePresent: null,
    documentTypeAttributeNamespace: null,
    expectedDocumentTypeMatched: null,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    pullDocResponseChecks: null,
    validationFailureReason: null,
    signatureBypassActive: null,
  });
  assert.match(diagnostics[0][1].stackLocation, /^src\//);
  assert.doesNotMatch(JSON.stringify(diagnostics), /private state material|authorization-code|v{10}|s{10}/);
});

test("IDTO callback failures report the precise safe provider stage and keep HTTP status", async () => {
  const diagnostics = [];
  const failedAttempts = [];
  const service = createDigilockerService({
    env: { NODE_ENV: "development" },
    logger: { error: (...args) => diagnostics.push(args) },
    stateStore: { async consumeAuthorizationState() { return TEST_STATE_CONTEXT; } },
    provider: {
      async getReference() {
        const error = new Error("provider body contains a private value");
        error.code = "IDTO_HTTP_ERROR";
        error.statusCode = 502;
        throw error;
      },
    },
    model: { async failVerification(attempt) { failedAttempts.push(attempt); } },
  });
  service.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR",
    issuerId: "in.gov.uidai",
    consentPurpose: "Synthetic test",
    stepNumber: 2,
    async verifyAndPersist() { assert.fail("provider failure must stop before document handling"); },
  });

  await assert.rejects(
    service.completeCallback(
      { code: "sensitive-code", code_verifier: "v".repeat(43), state: "s".repeat(43) },
      { correlationId: "correlation-test-provider" },
    ),
    (error) => error.statusCode === 503 &&
      error.code === "DIGILOCKER_UNAVAILABLE" &&
      error.cause?.code === "IDTO_HTTP_ERROR" &&
      error.cause?.statusCode === 502,
  );
  assert.equal(failedAttempts.length, 1);
  assert.equal(failedAttempts[0].failureCode, "IDTO_HTTP_ERROR");
  assert.equal(diagnostics.length, 1);
  const [label, diagnostic] = diagnostics[0];
  assert.equal(label, "[AquaPay DigiLocker] callback failure");
  assert.deepEqual(diagnostic, {
    correlationId: "correlation-test-provider",
    stage: "provider_get_reference",
    providerEndpoint: "get_reference",
    httpStatus: 502,
    errorCode: "IDTO_HTTP_ERROR",
    errorMessage: "IDTO returned a non-success HTTP status",
    stackLocation: diagnostic.stackLocation,
    contentType: null,
    responseFormat: "unavailable",
    jsonRootType: null,
    topLevelPropertyNames: [],
    topLevelValueTypes: {},
    expectedFields: {},
    providerErrorCode: null,
    documentFormat: null,
    providerDocumentFormat: null,
    providerXmlRootElementName: null,
    providerXmlNamespace: null,
    xmlRootElementName: null,
    xmlNamespace: null,
    xmlRootPrefixPresent: null,
    documentTypeAttributePresent: null,
    documentTypeAttributeLocalNamePresent: null,
    documentTypeAttributeNamespace: null,
    expectedDocumentTypeMatched: null,
    expectedIssuerPresent: "not_evaluated",
    requiredFieldPresence: { status: "not_evaluated" },
    pullDocResponseChecks: null,
    validationFailureReason: null,
    signatureBypassActive: null,
  });
  assert.match(diagnostic.stackLocation, /^src\//);
  assert.doesNotMatch(JSON.stringify(diagnostics), /provider body contains|sensitive-code|v{10}|s{10}/);
});

test("DigiLocker 503 errors remain 503 responses in the shared error middleware", () => {
  const originalError = console.error;
  console.error = () => {};
  const response = {
    headersSent: false,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; },
  };
  try {
    errorHandler(
      new ApiError(503, "DigiLocker verification is temporarily unavailable", [], "DIGILOCKER_UNAVAILABLE"),
      {}, response, () => {},
    );
  } finally {
    console.error = originalError;
  }
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    success: false,
    message: "Service temporarily unavailable",
    code: "DIGILOCKER_UNAVAILABLE",
  });
});

test("invalid callback logs only safe parameter metadata before forwarding the error", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalWarn = console.warn;
  const events = [];
  let forwardedError;
  process.env.NODE_ENV = "development";
  console.warn = (...args) => events.push({ type: "log", args });

  try {
    validateCallbackRequest({
      query: {
        code: "sensitive-authorization-code",
        state: "sensitive-state-value",
        provider_trace: "sensitive-provider-value",
      },
    }, {}, (error) => {
      forwardedError = error;
      events.push({ type: "next", error });
    });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    console.warn = originalWarn;
  }

  assert.equal(forwardedError?.code, "INVALID_CALLBACK");
  assert.deepEqual(events.map((event) => event.type), ["log", "next"]);
  const [label, diagnostic] = events[0].args;
  assert.equal(label, "[AquaPay DigiLocker] callback validation rejected");
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "duplicateFields",
    "invalidFieldNames",
    "missingFields",
    "outcome",
    "parameterNames",
    "present",
    "unexpectedNames",
  ]);
  assert.equal(diagnostic.outcome, "invalid_parameter_set");
  assert.deepEqual(diagnostic.missingFields, ["code_verifier"]);
  assert.deepEqual(diagnostic.unexpectedNames, ["provider_trace"]);
  const logText = JSON.stringify(events[0].args);
  assert.match(logText, /parameterNames/);
  assert.match(logText, /code_verifier/);
  assert.match(logText, /provider_trace/);
  assert.match(logText, /invalid_parameter_set/);
  assert.doesNotMatch(logText, /sensitive-authorization-code|sensitive-state-value|sensitive-provider-value/);
});

test("invalid callback diagnostics do not change production logging behavior", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalWarn = console.warn;
  const messages = [];
  let forwardedError;
  process.env.NODE_ENV = "production";
  console.warn = (...args) => messages.push(args);

  try {
    validateCallbackRequest({ query: { code: "x" } }, {}, (error) => { forwardedError = error; });
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    console.warn = originalWarn;
  }

  assert.equal(forwardedError?.code, "INVALID_CALLBACK");
  assert.deepEqual(messages, []);
});

test("invalid callback diagnostics identify duplicate and unsafe parameter names without values", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalWarn = console.warn;
  const messages = [];
  process.env.NODE_ENV = "development";
  console.warn = (...args) => messages.push(args);

  try {
    validateCallbackRequest({
      query: {
        code: ["sensitive-code-a", "sensitive-code-b"],
        code_verifier: "v".repeat(43),
        state: "s".repeat(43),
        ["bad\nparameter"]: "sensitive-value",
      },
    }, {}, () => {});
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    console.warn = originalWarn;
  }

  assert.equal(messages.length, 1);
  const [, diagnostic] = messages[0];
  assert.equal(diagnostic.outcome, "invalid_parameter_set");
  assert.deepEqual(diagnostic.duplicateFields, ["code"]);
  assert.deepEqual(diagnostic.invalidFieldNames, ["code"]);
  assert.deepEqual(diagnostic.unexpectedNames, ["<invalid-name>"]);
  assert.deepEqual(diagnostic.parameterNames, ["code", "code_verifier", "state", "<invalid-name>"]);
  const logText = JSON.stringify(messages[0]);
  assert.doesNotMatch(logText, /sensitive-code-a|sensitive-code-b|sensitive-value/);
  assert.doesNotMatch(logText, /bad\\nparameter/);
});

test("production authorization state refuses a non-TLS Redis configuration", async () => {
  let redisRequested = false;
  const store = createDigilockerStateStore({
    env: { NODE_ENV: "production", REDIS_URL: "redis://cache.internal:6379" },
    getRedisClient: async () => {
      redisRequested = true;
      return new FakeRedis(Date.now);
    },
  });
  await assert.rejects(
    store.createAuthorizationState(TEST_STATE_CONTEXT),
    /requires Redis TLS/,
  );
  assert.equal(redisRequested, false);
});

test("IDTO provider authenticates requests and uses only V1 route paths", async () => {
  const calls = [];
  let referenceMetadata;
  let issuedXmlMetadata;
  const provider = createDigilockerProvider({
    env: {
      IDTO_BASE_URL: "https://prod.idto.ai",
      IDTO_CLIENT_ID: "test-client-id",
      IDTO_API_KEY: "test-api-key",
    },
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      if (options.headers.Accept.includes("application/xml")) {
        return new Response("<Certificate/>", {
          status: 200,
          headers: { "content-type": "application/xml" },
        });
      }
      if (url.endsWith(ENDPOINTS.getReference)) {
        return new Response(JSON.stringify({ reference_key: "ref_1" }), {
          status: 200,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
      return new Response(JSON.stringify({ status: "success", code: 1000, url: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  assert.equal(provider.mode, "idto");

  await provider.initiateSession({ consent: true });
  assert.equal(calls[0].url, `https://prod.idto.ai${ENDPOINTS.initiateSession}`);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers["X-Client-ID"], "test-client-id");
  assert.equal(calls[0].options.headers["X-API-KEY"], "test-api-key");
  assert.equal(JSON.parse(calls[0].options.body).consent, true);

  await provider.getReference(
    { code: "authorization-code", code_verifier: "v".repeat(43) },
    { onResponseMeta: (metadata) => { referenceMetadata = metadata; } },
  );
  await provider.getUserDetails({ reference_key: "ref_1" });
  await provider.getIssuedDocs({ reference_key: "ref_1" });
  await provider.getIssuedDoc({ reference_key: "ref_1", uri: "document-uri" });
  const issuedXml = await provider.getIssuedDocsXml(
    { reference_key: "ref_1", uri: "document-uri" },
    { onResponseMeta: (metadata) => { issuedXmlMetadata = metadata; } },
  );
  await provider.getDocumentMaster();
  assert.deepEqual(calls.map(({ url, options }) => [url, options.method]), [
    [`https://prod.idto.ai${ENDPOINTS.initiateSession}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.getReference}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.userDetails}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.issuedDocs}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.getIssuedDocs}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.getIssuedDocsXml}`, "POST"],
    [`https://prod.idto.ai${ENDPOINTS.docMaster}`, "GET"],
  ]);
  assert.deepEqual(JSON.parse(calls[1].options.body), { code: "authorization-code", code_verifier: "v".repeat(43) });
  assert.equal(calls[1].options.headers["Content-Type"], "application/json");
  assert.equal(calls[1].options.headers.Accept, "application/json");
  assert.deepEqual(referenceMetadata, {
    httpStatus: 200,
    contentType: "application/json",
    responseFormat: "json",
    jsonRootType: "object",
    topLevelPropertyNames: ["reference_key"],
    topLevelValueTypes: { reference_key: "string" },
    expectedFields: { reference_key: { present: true, type: "string" } },
    providerErrorCode: null,
  });
  assert.deepEqual(JSON.parse(calls[2].options.body), { reference_key: "ref_1" });
  assert.deepEqual(JSON.parse(calls[3].options.body), { reference_key: "ref_1" });
  assert.deepEqual(JSON.parse(calls[4].options.body), { reference_key: "ref_1", uri: "document-uri" });
  assert.deepEqual(JSON.parse(calls[5].options.body), { reference_key: "ref_1", uri: "document-uri" });
  assert.equal(calls[6].options.body, undefined);
  assert.equal(issuedXml, "<Certificate/>");
  assert.deepEqual(issuedXmlMetadata, {
    httpStatus: 200,
    contentType: "application/xml",
    responseFormat: "xml",
    jsonRootType: null,
    topLevelPropertyNames: [],
    topLevelValueTypes: {},
    expectedFields: {},
    providerErrorCode: null,
  });
});

test("get_reference parser accepts only the documented reference_key contract without undocumented status or expiry fields", () => {
  assert.equal(validReferenceResponse({ reference_key: "opaque-provider-key" }), true);
  assert.equal(validReferenceResponse({ status: "success", reference_key: "opaque-provider-key" }), true);
  assert.equal(validReferenceResponse({ reference_key: "" }), false);
  assert.equal(validReferenceResponse({ reference_key: 123 }), false);
  assert.equal(validReferenceResponse({ reference_key: "  opaque-provider-key" }), false);
  assert.equal(validReferenceResponse({ reference_key: "opaque\u0000key" }), false);
  assert.equal(validReferenceResponse({ data: { reference_key: "not-assumed-envelope" } }), false);
  assert.equal(validReferenceResponse(["opaque-provider-key"]), false);
});

test("get_reference response diagnostics preserve HTTP metadata and disclose schema only", async () => {
  const diagnostics = [];
  const service = createDigilockerService({
    env: { NODE_ENV: "development" },
    logger: { error: (...args) => diagnostics.push(args) },
    stateStore: { async consumeAuthorizationState() { return TEST_STATE_CONTEXT; } },
    provider: {
      async getReference(_body, { onResponseMeta }) {
        onResponseMeta({
          httpStatus: 200,
          contentType: "application/json",
          responseFormat: "json",
          jsonRootType: "object",
          topLevelPropertyNames: ["status", "reference_key", "expires_at"],
          topLevelValueTypes: { status: "string", reference_key: "null", expires_at: "missing" },
          expectedFields: { reference_key: { present: true, type: "null" } },
          providerErrorCode: null,
        });
        return { status: "success", reference_key: null, expires_at: "private-expiry-value" };
      },
    },
    model: { async failVerification() {} },
  });
  service.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR",
    issuerId: "in.gov.uidai",
    consentPurpose: "Synthetic test",
    stepNumber: 2,
    async verifyAndPersist() { assert.fail("malformed reference response must stop callback"); },
  });

  await assert.rejects(
    service.completeCallback(
      { code: "sensitive-code", code_verifier: "v".repeat(43), state: "s".repeat(43) },
      { correlationId: "correlation-reference-shape" },
    ),
    (error) => error.statusCode === 503 && error.code === "DIGILOCKER_UNAVAILABLE",
  );
  const diagnostic = diagnostics[0][1];
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostic.correlationId, "correlation-reference-shape");
  assert.equal(diagnostic.stage, "provider_get_reference");
  assert.equal(diagnostic.providerEndpoint, "get_reference");
  assert.equal(diagnostic.httpStatus, 200);
  assert.equal(diagnostic.contentType, "application/json");
  assert.equal(diagnostic.responseFormat, "json");
  assert.deepEqual(diagnostic.topLevelPropertyNames, ["status", "reference_key", "expires_at"]);
  assert.deepEqual(diagnostic.expectedFields, { reference_key: { present: true, type: "null" } });
  assert.doesNotMatch(JSON.stringify(diagnostics), /sensitive-code|private-expiry-value|opaque-provider-key/);
});

test("signature bypass is explicit, development-only, real-IDTO-only, and loopback-database-only", () => {
  assert.deepEqual(getDigiLockerSignaturePolicy({
    NODE_ENV: "development",
    IDTO_PROVIDER_MODE: "idto",
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "false",
  }), {
    signatureVerified: true,
    developmentOnly: false,
    mode: "issuer_certificate",
  });
  assert.deepEqual(getDigiLockerSignaturePolicy({
    NODE_ENV: "development",
    IDTO_PROVIDER_MODE: "idto",
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
    IDTO_DEV_UNVERIFIED_DATABASE: "true",
    DB_HOST: "127.0.0.1",
    DB_NAME: "fintech_kyc",
  }), {
    signatureVerified: false,
    developmentOnly: true,
    mode: "development_unverified",
  });

  const unsafeBase = {
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
    IDTO_PROVIDER_MODE: "idto",
    IDTO_DEV_UNVERIFIED_DATABASE: "true",
    DB_HOST: "127.0.0.1",
    DB_NAME: "fintech_kyc",
  };
  assert.throws(() => getDigiLockerSignaturePolicy({ ...unsafeBase, NODE_ENV: "production" }), /only in NODE_ENV=development/);
  assert.throws(() => getDigiLockerSignaturePolicy({ ...unsafeBase, NODE_ENV: "test" }), /only in NODE_ENV=development/);
  assert.throws(() => getDigiLockerSignaturePolicy({ ...unsafeBase, NODE_ENV: "development", IDTO_PROVIDER_MODE: "mock" }), /real IDTO provider/);
  assert.throws(() => getDigiLockerSignaturePolicy({ ...unsafeBase, NODE_ENV: "development", DB_HOST: "db.example" }), /loopback database/);
  assert.throws(() => getDigiLockerSignaturePolicy({
    ...unsafeBase,
    NODE_ENV: "development",
    IDTO_DEV_UNVERIFIED_DATABASE: "false",
  }), /isolated local development database opt-in/);
  assert.throws(() => getDigiLockerSignaturePolicy({
    ...unsafeBase,
    NODE_ENV: "development",
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "yes",
  }), /must be true or false/);
});

test("mock provider is explicit, local-only, and exposes the shared V1 document sequence", async () => {
  const provider = createDigilockerProvider({
    env: {
      NODE_ENV: "development",
      IDTO_PROVIDER_MODE: "mock",
      IDTO_MOCK_BASE_URL: "http://127.0.0.1:3199",
    },
  });
  assert.equal(provider.mode, "mock");

  for (const document of ["ADHAR", "PANCR"]) {
    const state = "s".repeat(43);
    const initiation = await provider.initiateSession({
      consent: true,
      consent_purpose: "Local synthetic verification",
      redirect_url: "http://127.0.0.1:3199/api/kyc/digilocker/callback",
      redirect_to_signup: false,
      documents_for_consent: [document],
      state,
    });
    assert.equal(initiation.status, "success");
    assert.equal(initiation.code, 1000);
    const authorizationUrl = new URL(initiation.url);
    assert.equal(authorizationUrl.origin, "http://127.0.0.1:3199");
    assert.equal(authorizationUrl.pathname, "/api/kyc/digilocker/mock-authorize");

    const callback = provider.getMockCallbackParameters({ state, document });
    const reference = await provider.getReference(validateCallbackQuery(callback));
    assert.equal(reference.status, "success");
    const issuedDocs = await provider.getIssuedDocs({ reference_key: reference.reference_key });
    const selected = selectIssuedDocument(issuedDocs, {
      documentCode: document,
      issuerId: document === "ADHAR" ? "in.gov.uidai" : "in.gov.pan",
    });
    const xml = await provider.getIssuedDocsXml({
      reference_key: reference.reference_key,
      uri: selected.uri,
    });
    assert.match(xml, new RegExp(`<Certificate[^>]*type="${document}"`));
  }

  await assert.rejects(
    provider.getReference({ code: "aquapay-mock-pancr-v1", code_verifier: "x".repeat(43) }),
    /Invalid mock code verifier/,
  );
});

test("shared callback engine selects one configured document and dispatches through its handler", async () => {
  const calls = [];
  let handled;
  const service = createDigilockerService({
    provider: {
      async getReference(payload) {
        calls.push(["reference", payload]);
        return { status: "success", reference_key: "reference_1", expires_at: "2099-01-01T00:00:00Z" };
      },
      async getIssuedDocs(payload) {
        calls.push(["issued", payload]);
        return { status: "success", issued_docs: { items: [
          { type: "file", doctype: "DOCUMENT", issuerid: "issuer.example", uri: "issuer-document", mime: ["application/xml"] },
        ] } };
      },
      async getIssuedDocsXml(payload) {
        calls.push(["xml", payload]);
        return "<synthetic-document/>";
      },
    },
    model: { async failVerification() { assert.fail("successful callback must not fail"); } },
    stateStore: { async consumeAuthorizationState() { return { ...TEST_STATE_CONTEXT, verificationType: "testdoc" }; } },
  });
  service.registerVerificationHandler("testdoc", {
    documentCode: "DOCUMENT",
    issuerId: "issuer.example",
    consentPurpose: "Synthetic test",
    stepNumber: 7,
    async verifyAndPersist(context) {
      handled = context;
      return {
        extracted: {
          maskedIdentifier: "MASKED",
          verifiedName: "Test Identity",
          signatureVerified: true,
          developmentOnly: false,
          verificationMode: "issuer_certificate",
        },
        completion: { stepNumber: 7, steps_completed: 6 },
      };
    },
  });

  const result = await service.completeCallback({ code: "oauth-code", code_verifier: "v".repeat(43), state: "s".repeat(43) });
  assert.deepEqual(calls, [
    ["reference", { code: "oauth-code", code_verifier: "v".repeat(43) }],
    ["issued", { reference_key: "reference_1" }],
    ["xml", { reference_key: "reference_1", uri: "issuer-document" }],
  ]);
  assert.equal(handled.xml, "<synthetic-document/>");
  assert.equal(handled.attempt.verificationType, "testdoc");
  assert.deepEqual(result, {
    verificationType: "testdoc",
    verificationStatus: "verified",
    signatureVerified: true,
    developmentOnly: false,
    verificationMode: "issuer_certificate",
    maskedIdentifier: "MASKED",
    verifiedName: "Test Identity",
    stepNumber: 7,
    steps_completed: 6,
  });
});

test("shared authorization initiation preserves the IDTO V1 consent body and callback", async () => {
  const authorizationSessionId = "a".repeat(43);
  let body;
  const service = createDigilockerService({
    env: {
      NODE_ENV: "development",
      IDTO_PROVIDER_MODE: "idto",
      IDTO_REDIRECT_URL: "https://aquapay.example/api/kyc/digilocker/callback",
    },
    model: {
      async createPendingVerification(userId, verificationType) {
        return { ...TEST_STATE_CONTEXT, userId: String(userId), authorizationSessionId, verificationType };
      },
      async failVerification() { assert.fail("successful initiation should not fail"); },
    },
    stateStore: {
      async createAuthorizationState() { return { state: "s".repeat(43), expiresIn: 600 }; },
      async discardAuthorizationState() { return true; },
    },
    provider: {
      mode: "idto",
      async initiateSession(payload) {
        body = payload;
        return { status: "success", code: 1000, url: `https://digilocker.idto.ai/authorize?state=${payload.state}` };
      },
    },
  });
  service.registerVerificationHandler("testdoc", {
    documentCode: "DOCUMENT",
    issuerId: "issuer.example",
    consentPurpose: "AquaPay test purpose",
    stepNumber: 7,
    async verifyAndPersist() {},
  });

  const result = await service.initiateAuthorization("7", "testdoc", { consent: true });
  assert.deepEqual(body, {
    consent: true,
    consent_purpose: "AquaPay test purpose",
    redirect_url: "https://aquapay.example/api/kyc/digilocker/callback",
    redirect_to_signup: false,
    documents_for_consent: ["DOCUMENT"],
    state: "s".repeat(43),
  });
  assert.equal(result.stepNumber, 7);
  assert.equal(new URL(result.authorizationUrl).hostname, "digilocker.idto.ai");
});

test("mock provider cannot be selected in production or by implicit fallback", () => {
  assert.throws(
    () => createDigilockerProvider({
      env: { NODE_ENV: "production", IDTO_PROVIDER_MODE: "mock" },
    }),
    (error) => error.code === "IDTO_MOCK_MODE_FORBIDDEN",
  );
  assert.throws(
    () => createDigilockerProvider({
      env: { NODE_ENV: "development", IDTO_PROVIDER_MODE: "not-a-mode" },
    }),
    (error) => error.code === "IDTO_INVALID_PROVIDER_MODE",
  );
  assert.equal(
    createDigilockerProvider({ env: { NODE_ENV: "development" }, fetchImpl: async () => {} }).mode,
    "idto",
  );
});

test("provider timeouts and errors never expose response bodies", async () => {
  const env = {
    IDTO_BASE_URL: "https://prod.idto.ai",
    IDTO_CLIENT_ID: "test-client-id",
    IDTO_API_KEY: "test-api-key",
  };
  const timeoutProvider = createDigilockerProvider({
    env,
    timeoutMs: 2,
    fetchImpl: (_url, { signal }) => new Promise((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")), { once: true });
    }),
  });
  await assert.rejects(
    timeoutProvider.getReference({ code: "code", code_verifier: "x".repeat(43) }),
    (error) => error.code === "IDTO_TIMEOUT" && error.cause?.name === "AbortError" && !error.message.includes("code"),
  );

  let httpErrorMetadata;
  const errorProvider = createDigilockerProvider({
    env,
    fetchImpl: async () => new Response("Aadhaar 123456789012", {
      status: 401,
      headers: { "content-type": "application/json" },
    }),
  });
  await assert.rejects(
    errorProvider.getReference(
      { code: "code", code_verifier: "x".repeat(43) },
      { onResponseMeta: (metadata) => { httpErrorMetadata = metadata; } },
    ),
    (error) => error.code === "IDTO_HTTP_ERROR" && error.statusCode === 401 && !error.message.includes("123456789012"),
  );
  assert.deepEqual(httpErrorMetadata, {
    httpStatus: 401,
    contentType: "application/json",
    responseFormat: "invalid_json",
    jsonRootType: null,
    topLevelPropertyNames: [],
    topLevelValueTypes: {},
    expectedFields: { reference_key: { present: false, type: "missing" } },
    providerErrorCode: "IDTO_HTTP_ERROR",
  });
  assert.equal(JSON.stringify(httpErrorMetadata).includes("123456789012"), false);

  const invalidContentProvider = createDigilockerProvider({
    env,
    fetchImpl: async () => new Response("not xml", {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  });
  await assert.rejects(
    invalidContentProvider.getIssuedDocsXml({ reference_key: "ref_1", uri: "uri" }),
    (error) => error.code === "IDTO_INVALID_RESPONSE",
  );
});

function makeModelHarness({
  prerequisite = "completed",
  step = "pending",
  stepStatuses = {},
  stepsCompletedAfterUpdate = 2,
  verifications = [{
    id: 31,
    status: "pending",
    active_attempt: 1,
    provider_reference: MODEL_SESSION_REFERENCE,
  }],
  failOnCaseUpdate = false,
} = {}) {
  const calls = [];
  let committed = false;
  let rolledBack = false;
  const connection = {
    async beginTransaction() { calls.push(["begin"]); },
    async execute(sql, values = []) {
      calls.push([sql, values]);
      if (/FROM users/.test(sql)) return [[{ id: 7, status: "active" }]];
      if (/FROM kyc_cases/.test(sql) && /user_id/.test(sql)) {
        return [[{ id: 11, user_id: 7, status: "pending", steps_completed: 1 }]];
      }
      if (/FROM kyc_cases/.test(sql) && /case_id|WHERE id/.test(sql)) {
        return [[{ id: 11, status: "pending" }]];
      }
      if (/FROM kyc_steps/.test(sql) && /COUNT\(\*\)/.test(sql)) {
        return [[{ steps_completed: stepsCompletedAfterUpdate }]];
      }
      if (/FROM kyc_steps/.test(sql) && /step_number = \?/.test(sql)) {
        const stepNumber = values[1];
        return [[{
          id: stepNumber === 1 ? 1 : 2,
          status: stepStatuses[stepNumber] || (stepNumber === 1 ? prerequisite : step),
        }].filter((row) => row.status !== "missing")];
      }
      if (/FROM kyc_verifications/.test(sql)) return [verifications];
      if (failOnCaseUpdate && /^\s*UPDATE kyc_cases/.test(sql)) throw new Error("simulated database failure");
      if (/^\s*INSERT INTO kyc_verifications/.test(sql)) return [{ insertId: 31, affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    },
    async commit() { committed = true; calls.push(["commit"]); },
    async rollback() { rolledBack = true; },
    release() {},
  };
  return {
    pool: { async getConnection() { return connection; } },
    calls,
    committed: () => committed,
    rolledBack: () => rolledBack,
  };
}

test("already verified Aadhaar is protected from retry reset", async () => {
  const harness = makeModelHarness({
    prerequisite: "completed",
    step: "completed",
    verifications: [{ id: 31, status: "verified", active_attempt: 0 }],
  });
  const model = createModelForHarness(harness);
  await assert.rejects(
    model.createPendingVerification("7", "aadhaar"),
    (error) => error.message === "VERIFICATION_ALREADY_COMPLETED",
  );
  assert.equal(harness.rolledBack(), true);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_verifications/.test(sql)), false);
});

test("verified records cannot be overwritten by a callback or failure handler", async () => {
  const harness = makeModelHarness({
    verifications: [{ id: 31, status: "verified", active_attempt: 0, provider_reference: null }],
  });
  const model = createModelForHarness(harness);
  const context = {
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
  };

  await model.failVerification({ ...context, failureCode: "IDTO_NETWORK_ERROR" });
  await assert.rejects(
    model.completeVerification({
      ...context,
      maskedIdentifier: "XXXXXX9012",
      verifiedName: "Different Name",
      persistIdentity: async () => {},
    }),
    (error) => error.message === "VERIFICATION_ALREADY_COMPLETED",
  );
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_verifications/.test(sql)), false);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_steps/.test(sql)), false);
});

test("failed provider attempts mark the step failed and never complete it", async () => {
  const harness = makeModelHarness();
  const model = createModelForHarness(harness);
  await model.failVerification({
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
    failureCode: "IDTO_TIMEOUT",
  });
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_steps/.test(sql) && /status = 'failed'/.test(sql)), true);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_steps/.test(sql) && /status = 'completed'/.test(sql)), false);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_cases/.test(sql)), false);
  assert.equal(harness.committed(), true);
});

test("an active session blocks a duplicate, while an expired attempt can be retried", async () => {
  const activeHarness = makeModelHarness({
    verifications: [{ id: 31, status: "pending", active_attempt: 1 }],
  });
  const activeModel = createModelForHarness(activeHarness);
  await assert.rejects(
    activeModel.createPendingVerification("7", "aadhaar"),
    (error) => error.message === "VERIFICATION_IN_PROGRESS",
  );
  assert.equal(activeHarness.rolledBack(), true);
  assert.equal(activeHarness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_verifications/.test(sql)), false);

  const expiredHarness = makeModelHarness({
    verifications: [{ id: 31, status: "failed", active_attempt: 0 }],
  });
  const expiredModel = createModelForHarness(expiredHarness);
  const retry = await expiredModel.createPendingVerification("7", "aadhaar");
  assert.equal(retry.verificationId, "31");
  assert.equal(expiredHarness.committed(), true);
  assert.equal(expiredHarness.calls.some(([sql]) => typeof sql === "string" && /status = 'pending'/.test(sql)), true);
});

test("a callback from an older authorization session cannot change the active attempt", async () => {
  const activeReference = getAuthorizationSessionReference(MODEL_AUTHORIZATION_SESSION_ID);
  const staleHarness = makeModelHarness({
    verifications: [{
      id: 31,
      status: "pending",
      active_attempt: 1,
      provider_reference: activeReference,
    }],
  });
  const model = createModelForHarness(staleHarness);
  const staleContext = {
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: "o".repeat(43),
    verificationType: "aadhaar",
  };

  await model.failVerification({ ...staleContext, failureCode: "INVALID_PROVIDER_RESPONSE" });
  assert.equal(staleHarness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_steps/.test(sql)), false);

  await assert.rejects(
    model.completeVerification({
      ...staleContext,
      maskedIdentifier: "XXXXXX9012",
      verifiedName: "AquaPay Test User",
      persistIdentity: async () => {},
    }),
    (error) => error.message === "VERIFICATION_SESSION_NOT_ACTIVE",
  );
});

test("Aadhaar and PAN prerequisites are enforced", async () => {
  const harness = makeModelHarness({ prerequisite: "pending" });
  const model = createModelForHarness(harness);
  await assert.rejects(
    model.createPendingVerification("7", "aadhaar"),
    (error) => error.message === "KYC_PREREQUISITE_NOT_COMPLETED",
  );
  assert.equal(harness.rolledBack(), true);

  const panHarness = makeModelHarness({ prerequisite: "pending" });
  const panModel = createModelForHarness(panHarness);
  await assert.rejects(
    panModel.createPendingVerification("7", "pan"),
    (error) => error.message === "KYC_PREREQUISITE_NOT_COMPLETED",
  );
});

test("verification transaction rolls back case progress when persistence fails", async () => {
  const harness = makeModelHarness({ failOnCaseUpdate: true });
  const model = createModelForHarness(harness);
  await assert.rejects(model.completeVerification({
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
    maskedIdentifier: "XXXXXX9012",
    verifiedName: "AquaPay Test User",
    persistIdentity: async () => {},
  }), /simulated database failure/);
  assert.equal(harness.committed(), false);
  assert.equal(harness.rolledBack(), true);
});

test("identity persistence failure rolls back before KYC completion updates", async () => {
  const harness = makeModelHarness();
  const model = createDigilockerModel({
    dbPool: harness.pool,
    env: { NODE_ENV: "test" },
  });

  await assert.rejects(model.completeVerification({
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
    maskedIdentifier: "XXXXXX9012",
    verifiedName: "AquaPay Test User",
    persistIdentity: async () => {
      const error = new Error("Identity encryption failed");
      error.code = "IDENTITY_ENCRYPTION_NOT_CONFIGURED";
      throw error;
    },
  }), { code: "IDENTITY_ENCRYPTION_NOT_CONFIGURED" });
  assert.equal(harness.committed(), false);
  assert.equal(harness.rolledBack(), true);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_verifications/.test(sql)), false);
  assert.equal(harness.calls.some(([sql]) => typeof sql === "string" && /UPDATE kyc_steps/.test(sql)), false);
});

test("successful verification persists only masked data and updates step progress", async () => {
  const harness = makeModelHarness();
  const model = createModelForHarness(harness);
  const result = await model.completeVerification({
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
    maskedIdentifier: "XXXXXX9012",
    verifiedName: "AquaPay Test User",
    persistIdentity: async () => harness.calls.push(["identity-persisted"]),
  });

  assert.deepEqual(result, { verificationType: "aadhaar", stepNumber: 2, steps_completed: 2 });
  assert.equal(harness.committed(), true);
  assert.equal(harness.rolledBack(), false);

  const verificationUpdate = harness.calls.find(([sql]) =>
    typeof sql === "string" && /UPDATE kyc_verifications/.test(sql),
  );
  assert.deepEqual(verificationUpdate[1], [
    "idto_digilocker_v1",
    "XXXXXX9012",
    "AquaPay Test User",
    "31",
  ]);
  assert.equal(
    harness.calls.some(([sql, values]) =>
      typeof sql === "string" && /UPDATE kyc_steps/.test(sql) && /status = 'completed'/.test(sql) && values[1] === 2,
    ),
    true,
  );
  assert.equal(
    harness.calls.some(([sql, values]) =>
      typeof sql === "string" && /UPDATE kyc_cases/.test(sql) && values[0] === 2,
    ),
    true,
  );
  const persistenceIndex = harness.calls.findIndex(([action]) => action === "identity-persisted");
  const verificationUpdateIndex = harness.calls.findIndex(([sql]) =>
    typeof sql === "string" && /UPDATE kyc_verifications/.test(sql),
  );
  const stepUpdateIndex = harness.calls.findIndex(([sql]) =>
    typeof sql === "string" && /UPDATE kyc_steps/.test(sql) && /status = 'completed'/.test(sql),
  );
  const commitIndex = harness.calls.findIndex(([action]) => action === "commit");
  assert.ok(persistenceIndex >= 0 && persistenceIndex < verificationUpdateIndex);
  assert.ok(verificationUpdateIndex < stepUpdateIndex);
  assert.ok(stepUpdateIndex < commitIndex);
});

test("development-unverified completion is tagged in the approved provider column", async () => {
  const harness = makeModelHarness();
  const model = createModelForHarness(harness, {
      NODE_ENV: "development",
      IDTO_PROVIDER_MODE: "idto",
      IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
      IDTO_DEV_UNVERIFIED_DATABASE: "true",
      DB_HOST: "127.0.0.1",
      DB_NAME: "fintech_kyc",
  });
  await model.completeVerification({
    userId: "7",
    caseId: "11",
    verificationId: "31",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "aadhaar",
    maskedIdentifier: "XXXXXX9012",
    verifiedName: "AquaPay Test User",
    persistIdentity: async () => {},
    signatureVerified: false,
  });
  const verificationUpdate = harness.calls.find(([sql]) =>
    typeof sql === "string" && /UPDATE kyc_verifications/.test(sql),
  );
  assert.equal(verificationUpdate[1][0], DEVELOPMENT_UNVERIFIED_PROVIDER_NAME);
  assert.equal(harness.committed(), true);
});

test("production startup refuses a database containing development-unverified KYC records", async () => {
  let count = 0;
  const calls = [];
  const model = createDigilockerModel({
    dbPool: {
      async execute(sql, values) {
        calls.push([sql, values]);
        return [[{ development_unverified_count: count }]];
      },
    },
    env: { NODE_ENV: "production" },
  });
  assert.equal(await model.assertNoDevelopmentUnverifiedRecords(), true);
  count = 1;
  await assert.rejects(model.assertNoDevelopmentUnverifiedRecords(), /development-only unverified KYC records/);
  assert.equal(calls.length, 2);
  assert.match(calls[0][0], /FROM kyc_verifications/);
  assert.deepEqual(calls[0][1], [DEVELOPMENT_UNVERIFIED_PROVIDER_NAME]);
});

test("PAN verification completes Step 3 transactionally after Aadhaar prerequisite", async () => {
  const harness = makeModelHarness({
    stepStatuses: { 2: "completed", 3: "pending" },
    stepsCompletedAfterUpdate: 3,
    verifications: [{
      id: 32,
      status: "pending",
      active_attempt: 1,
      provider_reference: MODEL_SESSION_REFERENCE,
    }],
  });
  const model = createModelForHarness(harness);
  const result = await model.completeVerification({
    userId: "7",
    caseId: "11",
    verificationId: "32",
    authorizationSessionId: MODEL_AUTHORIZATION_SESSION_ID,
    verificationType: "pan",
    maskedIdentifier: "XXXXXX000A",
    verifiedName: "AquaPay Mock PAN",
    persistIdentity: async () => {},
  });

  assert.deepEqual(result, { verificationType: "pan", stepNumber: 3, steps_completed: 3 });
  assert.equal(harness.committed(), true);
  assert.equal(harness.rolledBack(), false);
  assert.equal(harness.calls.some(([sql, values]) =>
    typeof sql === "string" && /UPDATE kyc_steps/.test(sql) && /status = 'completed'/.test(sql) && values[1] === 3,
  ), true);
  assert.equal(harness.calls.some(([sql, values]) =>
    typeof sql === "string" && /UPDATE kyc_cases/.test(sql) && values[0] === 3,
  ), true);
});
