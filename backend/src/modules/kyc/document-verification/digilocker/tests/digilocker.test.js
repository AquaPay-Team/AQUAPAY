import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import "../../../../auth/setupEnv.js";
import { createRealDigilockerProvider, ENDPOINTS } from "../digilocker.provider.js";
import { createDigilockerService, diagnoseReferenceResponse, validReferenceResponse } from "../digilocker.service.js";
import { createDigilockerModel } from "../digilocker.model.js";
import { createDigilockerStateStore } from "../digilockerStateStore.js";
import { validateCallbackQuery } from "../digilocker.validator.js";
import { createAadhaarService } from "../../aadhaar/aadhaar.service.js";
import { validateAadhaarXml } from "../../aadhaar/aadhaar.validator.js";

const STATE = "s".repeat(43);
const SESSION = "a".repeat(43);
const VERIFIER = "v".repeat(43);
const UIDAI_FAILURE_XML = readFileSync(new URL("../fixtures/aadhaar.xml", import.meta.url), "utf8").replace('ret="Y"', 'ret="N"');
const MASKED_UID_XML = readFileSync(new URL("../fixtures/aadhaar.xml", import.meta.url), "utf8")
  .replace('uid="123456789012"', 'uid="xxxxxx9012"');
const PROVIDER_CONFIG = {
  NODE_ENV: "test",
  IDTO_BASE_URL: "https://prod.idto.ai",
  IDTO_CLIENT_ID: "synthetic-client-id",
  IDTO_API_KEY: "synthetic-api-key",
};

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

test("callback accepts documented verifier and observed camelCase alias; rejects missing, duplicate, and invalid state", () => {
  assert.deepEqual(validateCallbackQuery({ code: "authorization-code", code_verifier: VERIFIER, state: STATE }), {
    code: "authorization-code", code_verifier: VERIFIER, state: STATE,
  });
  assert.deepEqual(validateCallbackQuery({ code: "authorization-code", codeVerifier: VERIFIER, clientId: "metadata", state: STATE }), {
    code: "authorization-code", code_verifier: VERIFIER, state: STATE,
  });
  for (const query of [
    { code: "authorization-code", state: STATE },
    { code: "authorization-code", codeVerifier: VERIFIER, code_verifier: VERIFIER, state: STATE },
    { code: "authorization-code", code_verifier: VERIFIER, state: "bad" },
    { code: "authorization-code", code_verifier: [VERIFIER], state: STATE },
  ]) assert.throws(() => validateCallbackQuery(query), { code: "INVALID_CALLBACK" });
});

test("MySQL authorization state binds user, case, verification and session with TTL and single-use consumption", async () => {
  let clock = 1000;
  let row = null;
  const calls = [];
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute(sql, params = []) {
      calls.push(sql);
      if (sql.includes("FROM kyc_digilocker_sessions") && sql.includes("authorization_state_hash")) {
        return [[row?.authorization_state_hash === params[0] ? row : null].filter(Boolean)];
      }
      if (sql.includes("SET status = 'processing'")) {
        if (row?.status === "pending" && new Date(row.state_expires_at).getTime() > clock) {
          row.status = "processing";
          row.authorization_code_hash = params[0];
          row.code_verifier_hash = params[1];
          return [{ affectedRows: 1 }];
        }
        return [{ affectedRows: 0 }];
      }
      if (sql.includes("SET status = 'expired'")) {
        if (row) row.status = "expired";
        return [{ affectedRows: 1 }];
      }
      return [{ affectedRows: 0 }];
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const store = createDigilockerStateStore({
    dbPool: { async getConnection() { return connection; } },
    now: () => clock,
    ttlSeconds: 600,
    randomBytes: () => Buffer.alloc(32, 7),
    randomUUID: () => "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
  });
  const authorization = store.prepareAuthorizationState();
  row = {
    id: 1,
    session_uuid: authorization.sessionId,
    user_id: "52",
    case_id: "13",
    verification_id: "31",
    verification_type: "aadhaar",
    authorization_session_hash: createHash("sha256").update(SESSION).digest("hex"),
    authorization_state_hash: authorization.stateHash,
    state_expires_at: authorization.expiresAt,
    status: "pending",
  };
  const result = await store.consumeAuthorizationState(authorization.state, { code: "synthetic-code", codeVerifier: VERIFIER });
  assert.deepEqual(result, {
    digilockerSessionId: authorization.sessionId,
    userId: "52", caseId: "13", verificationId: "31",
    authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"),
    verificationType: "aadhaar",
  });
  assert.equal(row.authorization_code_hash, createHash("sha256").update("synthetic-code").digest("hex"));
  assert.equal(row.code_verifier_hash, createHash("sha256").update(VERIFIER).digest("hex"));
  assert.equal(JSON.stringify(row).includes(VERIFIER), false);
  assert.equal(await store.consumeAuthorizationState(authorization.state, { code: "synthetic-code", codeVerifier: VERIFIER }), null);
  assert.equal(row.status, "processing");
  assert.equal(row.authorization_state_hash.includes(authorization.state), false);

  const expiring = createDigilockerStateStore({
    dbPool: { async getConnection() { return connection; } },
    now: () => clock,
    randomBytes: () => Buffer.alloc(32, 8),
    randomUUID: () => "a22e7a21-917b-4ce3-96ad-5209db9ac9aa",
  });
  const shortLived = expiring.prepareAuthorizationState();
  row = {
    id: 2,
    session_uuid: shortLived.sessionId,
    user_id: "52",
    case_id: "13",
    verification_id: "31",
    verification_type: "aadhaar",
    authorization_session_hash: createHash("sha256").update(SESSION).digest("hex"),
    authorization_state_hash: shortLived.stateHash,
    state_expires_at: shortLived.expiresAt,
    status: "pending",
  };
  clock += 600001;
  assert.equal(await expiring.consumeAuthorizationState(shortLived.state, { code: "synthetic-code", codeVerifier: VERIFIER }), null);
  assert.match(createHash("sha256").update(authorization.state).digest("hex"), /^[a-f0-9]{64}$/);
  assert.equal(row.status, "expired");
});

test("concurrent callbacks atomically claim an authorization state only once", async () => {
  let row = {
    id: 9,
    session_uuid: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    user_id: "52",
    case_id: "13",
    verification_id: "31",
    verification_type: "aadhaar",
    authorization_session_hash: createHash("sha256").update(SESSION).digest("hex"),
    authorization_state_hash: createHash("sha256").update(STATE).digest("hex"),
    state_expires_at: new Date(Date.now() + 60_000),
    status: "pending",
  };
  let transactionTail = Promise.resolve();
  const dbPool = {
    async getConnection() {
      let releaseTransaction;
      return {
        async beginTransaction() {
          const previous = transactionTail;
          transactionTail = new Promise((resolve) => { releaseTransaction = resolve; });
          await previous;
        },
        async execute(sql, params = []) {
          if (sql.includes("FROM kyc_digilocker_sessions") && sql.includes("authorization_state_hash")) {
            return [[row?.authorization_state_hash === params[0] ? row : null].filter(Boolean)];
          }
          if (sql.includes("SET status = 'processing'")) {
            if (row?.status !== "pending") return [{ affectedRows: 0 }];
            row = { ...row, status: "processing", authorization_code_hash: params[0], code_verifier_hash: params[1] };
            return [{ affectedRows: 1 }];
          }
          return [{ affectedRows: 0 }];
        },
        async commit() { releaseTransaction?.(); },
        async rollback() { releaseTransaction?.(); },
        release() {},
      };
    },
  };
  const store = createDigilockerStateStore({ dbPool });
  const outcomes = await Promise.all([
    store.consumeAuthorizationState(STATE, { code: "synthetic-code-a", codeVerifier: VERIFIER }),
    store.consumeAuthorizationState(STATE, { code: "synthetic-code-b", codeVerifier: VERIFIER }),
  ]);
  assert.equal(outcomes.filter(Boolean).length, 1);
  assert.equal(outcomes.filter((value) => value === null).length, 1);
  assert.equal(row.status, "processing");
});

test("pending KYC verification, Step 2, and authorization session are created in one MySQL transaction", async () => {
  const calls = [];
  const preparedAuthorization = {
    state: STATE,
    stateHash: createHash("sha256").update(STATE).digest("hex"),
    sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    expiresIn: 600,
    expiresAt: new Date(Date.now() + 600_000),
  };
  let storedSessionParams;
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM users")) return [[{ id: "52", status: "active" }]];
      if (sql.includes("FROM kyc_cases")) return [[{ id: "13", user_id: "52", status: "pending", steps_completed: 1 }]];
      if (sql.includes("FROM kyc_steps") && sql.includes("step_number = ?")) {
        return Number(params[1]) === 1 ? [[{ status: "completed" }]] : [[{ id: "21", status: "pending" }]];
      }
      if (sql.includes("FROM kyc_verifications")) return [[]];
      if (sql.includes("INSERT INTO kyc_verifications")) return [{ insertId: 31, affectedRows: 1 }];
      if (sql.includes("INSERT INTO kyc_digilocker_sessions")) {
        storedSessionParams = params;
        return [{ insertId: 91, affectedRows: 1 }];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const model = createDigilockerModel({ dbPool: { async getConnection() { return connection; } }, env: { NODE_ENV: "test" } });
  const result = await model.createPendingVerification("52", "aadhaar", preparedAuthorization);
  assert.equal(result.verificationId, "31");
  assert.equal(result.caseId, "13");
  assert.equal(result.stepNumber, 2);
  assert.ok(storedSessionParams);
  assert.equal(storedSessionParams[0], preparedAuthorization.sessionId);
  assert.equal(storedSessionParams[6], preparedAuthorization.stateHash);
  assert.equal(storedSessionParams.includes(STATE), false);
  assert.equal(calls[0], "begin");
  assert.equal(calls.at(-2), "commit");
  assert.equal(calls.at(-1), "release");
  assert.equal(calls.some((call) => call === "rollback"), false);
});

test("MySQL status lookup is scoped to the authenticated user and exposes only safe status fields", async () => {
  let capturedParams;
  const row = {
    session_uuid: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    status: "processing",
    current_stage: "fetch_aadhaar",
    failure_code: null,
    state_expires_at: new Date(Date.now() + 60_000),
    reference_expires_at: null,
    consumed_at: new Date(),
    created_at: new Date(),
    updated_at: new Date(),
  };
  const connection = {
    async beginTransaction() {},
    async execute(sql, params) {
      if (sql.includes("FROM kyc_digilocker_sessions")) {
        capturedParams = params;
        return [[row]];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() {},
    async rollback() {},
    release() {},
  };
  const store = createDigilockerStateStore({ dbPool: { async getConnection() { return connection; } } });
  const result = await store.getSessionStatus("52", row.session_uuid);
  assert.equal(capturedParams[0], "52");
  assert.equal(capturedParams[1], row.session_uuid);
  assert.equal(result.status, "PENDING");
  assert.equal(result.sessionId, row.session_uuid);
  assert.equal(result.stage, "fetch_aadhaar");
  assert.equal(Object.hasOwn(result, "referenceKey"), false);
});

test("status lookup expires a stale processing callback and releases KYC retry state", async () => {
  const now = Date.now();
  const row = {
    session_uuid: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    user_id: "52", case_id: "13", verification_id: "31", verification_type: "aadhaar",
    authorization_session_hash: createHash("sha256").update(SESSION).digest("hex"),
    status: "processing", current_stage: "fetch_aadhaar", failure_code: null,
    state_expires_at: new Date(now + 60_000), reference_expires_at: null,
    consumed_at: new Date(now - 601_000), created_at: new Date(now - 700_000), updated_at: new Date(now - 601_000),
  };
  const statements = [];
  const connection = {
    async beginTransaction() {},
    async execute(sql) {
      statements.push(sql);
      if (sql.includes("FROM kyc_digilocker_sessions")) return [[row]];
      return [{ affectedRows: 1 }];
    },
    async commit() {}, async rollback() {}, release() {},
  };
  const store = createDigilockerStateStore({ dbPool: { async getConnection() { return connection; } }, now: () => now });
  const result = await store.getSessionStatus("52", row.session_uuid);
  assert.equal(result.status, "FAILED");
  assert.equal(result.failureCode, "CALLBACK_PROCESSING_EXPIRED");
  assert.equal(result.stage, "expired");
  assert.ok(statements.some((sql) => sql.includes("UPDATE kyc_steps")));
  assert.ok(statements.some((sql) => sql.includes("UPDATE kyc_digilocker_sessions") && sql.includes("status = 'processing'")));
});

test("provider sends the configured four IDTO operations with authenticated headers and returns raw Aadhaar XML", async () => {
  const calls = [];
  const responses = [
    jsonResponse({ status: "success", code: 1000, url: `https://digilocker.idto.ai/authorize?state=${STATE}` }),
    jsonResponse({ status: "success", reference_key: "synthetic-reference" }),
    jsonResponse({ status: "success", provider_defined: true }),
    new Response("<Certificate><CertificateData><KycRes ret=\"Y\"/></CertificateData></Certificate>", {
      status: 200, headers: { "content-type": "application/xml; charset=utf-8" },
    }),
  ];
  const provider = createRealDigilockerProvider({
    env: PROVIDER_CONFIG,
    fetchImpl: async (url, options) => { calls.push({ url, options }); return responses.shift(); },
  });
  await provider.initiateSession({ consent: true, consent_purpose: "synthetic", redirect_url: "https://example.test/callback", state: STATE });
  await provider.getReference({ code: "authorization-code", code_verifier: VERIFIER });
  await provider.getUserDetails({ reference_key: "synthetic-reference" });
  let xmlResponseMetadata;
  const xml = await provider.fetchAadhaar({ reference_key: "synthetic-reference" }, {
    onResponseMeta: (metadata) => { xmlResponseMetadata = metadata; },
  });

  assert.deepEqual(calls.map(({ url }) => url), [
    `https://prod.idto.ai${ENDPOINTS.initiateSession}`,
    `https://prod.idto.ai${ENDPOINTS.getReference}`,
    `https://prod.idto.ai${ENDPOINTS.userDetails}`,
    `https://prod.idto.ai${ENDPOINTS.fetchAadhaar}`,
  ]);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[1].options.headers["X-Client-ID"], PROVIDER_CONFIG.IDTO_CLIENT_ID);
  assert.equal(calls[1].options.headers["X-API-KEY"], PROVIDER_CONFIG.IDTO_API_KEY);
  assert.deepEqual(JSON.parse(calls[1].options.body), { code: "authorization-code", code_verifier: VERIFIER });
  assert.deepEqual(JSON.parse(calls[2].options.body), { reference_key: "synthetic-reference" });
  assert.deepEqual(JSON.parse(calls[3].options.body), { reference_key: "synthetic-reference" });
  assert.equal(xml.startsWith("<Certificate>"), true);
  assert.equal(xmlResponseMetadata.responseFormat, "xml");
  assert.equal(xmlResponseMetadata.contentLengthBytes, Buffer.byteLength(xml, "utf8"));
  assert.deepEqual(xmlResponseMetadata.topLevelPropertyNames, []);
});

test("state store persists and reloads only encrypted reference-key material bound to the session", async () => {
  const calls = [];
  let stored;
  const context = {
    sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    userId: "52", caseId: "13", verificationId: "31",
  };
  const store = createDigilockerStateStore({
    dbPool: {
      async execute(sql, params) {
        calls.push(sql);
        if (sql.startsWith("UPDATE")) {
          stored = {
            ciphertext: params[0], iv: params[1], authenticationTag: params[2], keyVersion: params[3],
            reference_expires_at: params[4],
          };
          return [{ affectedRows: 1 }];
        }
        return [[{
          reference_key_ciphertext: stored.ciphertext,
          reference_key_iv: stored.iv,
          reference_key_authentication_tag: stored.authenticationTag,
          reference_key_version: stored.keyVersion,
          reference_expires_at: stored.reference_expires_at,
        }]];
      },
    },
    encrypt(value, aad) {
      assert.equal(value, "synthetic-reference");
      assert.deepEqual(aad, { ...context, sessionId: context.sessionId });
      return { ciphertext: Buffer.from("ciphertext"), iv: Buffer.alloc(12, 1), authenticationTag: Buffer.alloc(16, 2), keyVersion: 7 };
    },
    decrypt(encrypted, aad) {
      assert.equal(encrypted.keyVersion, 7);
      assert.deepEqual(aad, context);
      return "synthetic-reference";
    },
  });
  const attempt = {
    digilockerSessionId: context.sessionId,
    userId: context.userId, caseId: context.caseId, verificationId: context.verificationId,
  };
  await store.saveReferenceKey(attempt, "synthetic-reference", new Date(Date.now() + 60_000));
  assert.equal(stored.ciphertext.toString(), "ciphertext");
  assert.equal(stored.ciphertext.toString().includes("synthetic-reference"), false);
  assert.ok(stored.reference_expires_at instanceof Date);
  assert.ok(stored.reference_expires_at.getTime() > Date.now());
  assert.equal(await store.loadReferenceKey(attempt), "synthetic-reference");
  assert.equal(calls.length, 2);
});

test("get_reference accepts the complete observed response shape and diagnostics never contain the reference key", () => {
  const now = Date.now();
  const referenceKey = "synthetic-reference-key-NEVER-LOG";
  const response = {
    status: "success",
    reference_key: referenceKey,
    expires_at: new Date(now + 60_000).toISOString(),
    chargeble: "0",
    user_consent: "true",
    tranx_id: "synthetic-transaction-id",
    timestamp: new Date(now).toISOString(),
  };
  const diagnostics = diagnoseReferenceResponse(response, now);

  assert.equal(validReferenceResponse(response, now), true);
  assert.equal(diagnostics.valid, true);
  assert.equal(diagnostics.statusPresent, true);
  assert.equal(diagnostics.statusType, "string");
  assert.equal(diagnostics.statusMatchesAcceptedLiteral, true);
  assert.equal(diagnostics.referenceKeyType, "string");
  assert.equal(diagnostics.referenceKeyLength, referenceKey.length);
  assert.equal(diagnostics.referenceKeyNonEmpty, true);
  assert.equal(diagnostics.referenceKeyWithinLengthLimit, true);
  assert.equal(diagnostics.referenceKeyTrimmed, true);
  assert.equal(diagnostics.referenceKeyHasControlCharacters, false);
  assert.equal(diagnostics.expiresAtPresent, true);
  assert.equal(diagnostics.expiresAtType, "string");
  assert.equal(diagnostics.expiresAtParses, true);
  assert.equal(diagnostics.expiresAtInFuture, true);
  assert.equal(diagnostics.failureReason, "none");
  assert.equal(JSON.stringify(diagnostics).includes(referenceKey), false);
  assert.equal(JSON.stringify(diagnostics).includes("synthetic-transaction-id"), false);
});

test("get_reference keeps missing status and optional expiry behavior, while rejecting unrecognized status values", () => {
  const now = Date.now();
  const withoutStatusOrExpiry = { reference_key: "synthetic-reference" };
  const missingStatusDiagnostics = diagnoseReferenceResponse(withoutStatusOrExpiry, now);
  assert.equal(validReferenceResponse(withoutStatusOrExpiry, now), true);
  assert.equal(missingStatusDiagnostics.statusPresent, false);
  assert.equal(missingStatusDiagnostics.statusType, "missing");
  assert.equal(missingStatusDiagnostics.statusMatchesAcceptedLiteral, false);
  assert.equal(missingStatusDiagnostics.expiresAtPresent, false);
  assert.equal(missingStatusDiagnostics.expiresAtParses, null);
  assert.equal(missingStatusDiagnostics.expiresAtInFuture, null);

  for (const status of ["error", "Success", 200]) {
    const diagnostics = diagnoseReferenceResponse({ reference_key: "synthetic-reference", status }, now);
    assert.equal(validReferenceResponse({ reference_key: "synthetic-reference", status }, now), false);
    assert.equal(diagnostics.statusPresent, true);
    assert.equal(diagnostics.statusMatchesAcceptedLiteral, false);
    assert.equal(diagnostics.failureReason, "status_not_exact_success");
    assert.equal(JSON.stringify(diagnostics).includes(String(status)), false);
  }
});

test("get_reference diagnostics distinguish invalid reference-key type, length, whitespace, and control characters", () => {
  const now = Date.now();
  const cases = [
    [{ reference_key: 12 }, "reference_key_wrong_type"],
    [{ reference_key: "" }, "reference_key_empty"],
    [{ reference_key: "r".repeat(4097) }, "reference_key_too_long"],
    [{ reference_key: " padded-reference " }, "reference_key_surrounding_whitespace"],
    [{ reference_key: "reference\u0001key" }, "reference_key_control_character"],
  ];
  for (const [response, expectedReason] of cases) {
    const diagnostics = diagnoseReferenceResponse(response, now);
    assert.equal(validReferenceResponse(response, now), false);
    assert.equal(diagnostics.failureReason, expectedReason);
  }
});

test("get_reference diagnostics distinguish malformed, expired, and non-string expiry values", () => {
  const now = Date.now();
  const cases = [
    [{ reference_key: "synthetic-reference", expires_at: "not-a-date" }, "expires_at_unparseable"],
    [{ reference_key: "synthetic-reference", expires_at: new Date(now - 1).toISOString() }, "expires_at_not_future"],
    [{ reference_key: "synthetic-reference", expires_at: 1 }, "expires_at_wrong_type"],
  ];
  for (const [response, expectedReason] of cases) {
    const diagnostics = diagnoseReferenceResponse(response, now);
    assert.equal(validReferenceResponse(response, now), false);
    assert.equal(diagnostics.failureReason, expectedReason);
  }
});

test("development timestamp diagnostics report UTC instants and expired reference lifetime", () => {
  const now = Date.parse("2026-02-03T04:05:06.789Z");
  const expiresAt = new Date(now - 2_500).toISOString();
  const diagnostics = diagnoseReferenceResponse(
    { reference_key: "synthetic-reference", expires_at: expiresAt },
    now,
    { includeTimestampDiagnostics: true },
  );

  assert.equal(diagnostics.valid, false);
  assert.equal(diagnostics.failureReason, "expires_at_not_future");
  assert.equal(diagnostics.serverTimeUtc, "2026-02-03T04:05:06.789Z");
  assert.equal(diagnostics.parsedExpiresAtUtc, expiresAt);
  assert.equal(diagnostics.remainingLifetimeSeconds, -2.5);
  assert.equal(diagnostics.serverClockValid, true);
  assert.equal(JSON.stringify(diagnostics).includes("synthetic-reference"), false);
});

test("invalid server clock is reported without adding timestamp details by default", () => {
  const response = { reference_key: "synthetic-reference" };
  const ordinary = diagnoseReferenceResponse(response, Number.NaN);
  const development = diagnoseReferenceResponse(response, Number.NaN, { includeTimestampDiagnostics: true });

  assert.equal(Object.hasOwn(ordinary, "serverTimeUtc"), false);
  assert.equal(development.valid, true);
  assert.equal(development.serverTimeUtc, null);
  assert.equal(development.parsedExpiresAtUtc, null);
  assert.equal(development.remainingLifetimeSeconds, null);
  assert.equal(development.serverClockValid, false);
});

test("development get_reference failure log includes only allowlisted validation facts; production emits no diagnostic", async () => {
  const rawValues = {
    code: "synthetic-authorization-code-NEVER-LOG",
    code_verifier: `v${"x".repeat(42)}`,
    state: `s${"x".repeat(42)}`,
    reference_key: "synthetic-reference-key-NEVER-LOG",
  };
  const attempt = {
    userId: "52", caseId: "13", verificationId: "31",
    digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"),
    verificationType: "aadhaar",
  };
  const responseMetadata = {
    httpStatus: 200,
    contentType: "application/json",
    responseFormat: "json",
    topLevelPropertyNames: ["status", "reference_key", "expires_at", "chargeble", "user_consent", "tranx_id", "timestamp"],
    topLevelValueTypes: { status: "string", reference_key: "string", expires_at: "string" },
    expectedFields: {
      reference_key: { present: true, type: "string" },
      expires_at: { present: true, type: "string" },
    },
  };
  const logs = [];
  const logger = { error: (...args) => logs.push(args) };
  const provider = {
    mode: "idto",
    async getReference(_body, options) {
      options?.onResponseMeta?.(responseMetadata);
      return {
        status: "provider-specific-status",
        reference_key: rawValues.reference_key,
        expires_at: new Date(Date.now() + 60_000).toISOString(),
      };
    },
  };
  const stateStore = {
    async consumeAuthorizationState() { return attempt; },
    async setStage() {},
  };
  const model = { async failVerification() {} };

  const developmentService = createDigilockerService({
    provider, stateStore, model, env: { NODE_ENV: "development" }, logger,
  });
  developmentService.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "test", stepNumber: 2,
    async retrieveDocument() {}, async verifyAndPersist() {},
  });
  await assert.rejects(developmentService.completeCallback({
    code: rawValues.code, code_verifier: rawValues.code_verifier, state: rawValues.state,
  }), { code: "INVALID_REFERENCE_RESPONSE" });
  assert.equal(logs.length, 1);
  const serializedLog = JSON.stringify(logs);
  for (const value of Object.values(rawValues)) assert.equal(serializedLog.includes(value), false);
  const referenceValidation = logs[0][1].referenceValidation;
  assert.equal(referenceValidation.valid, false);
  assert.equal(referenceValidation.statusMatchesAcceptedLiteral, false);
  assert.equal(referenceValidation.failureReason, "status_not_exact_success");
  assert.equal(referenceValidation.serverClockValid, true);
  assert.equal(new Date(referenceValidation.serverTimeUtc).toISOString(), referenceValidation.serverTimeUtc);
  assert.equal(new Date(referenceValidation.parsedExpiresAtUtc).toISOString(), referenceValidation.parsedExpiresAtUtc);
  assert.ok(referenceValidation.remainingLifetimeSeconds > 0);

  logs.length = 0;
  const productionService = createDigilockerService({
    provider, stateStore, model, env: { NODE_ENV: "production" }, logger,
  });
  productionService.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "test", stepNumber: 2,
    async retrieveDocument() {}, async verifyAndPersist() {},
  });
  await assert.rejects(productionService.completeCallback({
    code: rawValues.code, code_verifier: rawValues.code_verifier, state: rawValues.state,
  }), { code: "INVALID_REFERENCE_RESPONSE" });
  assert.equal(logs.length, 0);
});

test("Aadhaar callback stops when user_details explicitly reports failure", async () => {
  const calls = [];
  const provider = {
    mode: "idto",
    async getReference() { calls.push("get_reference"); return { reference_key: "synthetic-reference" }; },
    async getUserDetails() { calls.push("user_details"); return { status: "error" }; },
    async fetchAadhaar() { calls.push("fetch_aadhaar"); return "<Certificate/>"; },
  };
  const stateStore = {
    async consumeAuthorizationState() {
      return {
        userId: "52", caseId: "13", verificationId: "31", digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
        authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"), verificationType: "aadhaar",
      };
    },
    async saveReferenceKey() {},
    async loadReferenceKey() { return "synthetic-reference"; },
    async setStage() {},
  };
  const service = createDigilockerService({
    provider,
    stateStore,
    model: { async failVerification() { calls.push("failed"); } },
    env: { NODE_ENV: "test" },
  });
  createAadhaarService({ digilocker: service });
  await assert.rejects(
    service.completeCallback({ code: "authorization-code", code_verifier: VERIFIER, state: STATE }),
    { code: "IDTO_OPERATION_FAILED" },
  );
  assert.deepEqual(calls, ["get_reference", "user_details", "failed"]);
});

test("provider failures at initiation and each callback operation persist a safe terminal failure", async (t) => {
  const preparedAuthorization = {
    state: STATE,
    stateHash: createHash("sha256").update(STATE).digest("hex"),
    sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    expiresIn: 600,
    expiresAt: new Date(Date.now() + 600_000),
  };
  const attempt = {
    userId: "52", caseId: "13", verificationId: "31",
    digilockerSessionId: preparedAuthorization.sessionId,
    authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"),
    authorizationSessionId: SESSION,
    verificationType: "aadhaar",
  };
  const failure = Object.assign(new Error("sanitized provider failure"), { code: "IDTO_TIMEOUT" });

  await t.test("initiate_session failure", async () => {
    const calls = [];
    const stateStore = {
      prepareAuthorizationState: () => preparedAuthorization,
      async discardAuthorizationState() { calls.push("discard-state"); },
    };
    const model = {
      async createPendingVerification() { return { ...attempt }; },
      async failVerification(input) { calls.push(input.failureCode); },
    };
    const service = createDigilockerService({
      provider: { mode: "idto", async initiateSession() { throw failure; } },
      model, stateStore, env: { IDTO_REDIRECT_URL: "https://api.example.test/api/kyc/digilocker/callback" },
    });
    service.registerVerificationHandler("aadhaar", {
      documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "test", stepNumber: 2,
      async retrieveDocument() {}, async verifyAndPersist() {},
    });
    await assert.rejects(service.initiateAuthorization("52", "aadhaar", { consent: true }), { code: "IDTO_TIMEOUT" });
    assert.deepEqual(calls, ["discard-state", "IDTO_TIMEOUT"]);
  });

  for (const failedOperation of ["get_reference", "user_details", "fetch_aadhaar"]) {
    await t.test(`${failedOperation} failure`, async () => {
      const calls = [];
      const provider = {
        mode: "idto",
        async getReference(body) {
          calls.push(["get_reference", body]);
          if (failedOperation === "get_reference") throw failure;
          return { status: "success", reference_key: "synthetic-reference" };
        },
        async getUserDetails(body) {
          calls.push(["user_details", body]);
          if (failedOperation === "user_details") throw failure;
          return { status: "success" };
        },
        async fetchAadhaar(body) {
          calls.push(["fetch_aadhaar", body]);
          if (failedOperation === "fetch_aadhaar") throw failure;
          return "<Certificate/>";
        },
      };
      const stateStore = {
        async consumeAuthorizationState() { return { ...attempt }; },
        async saveReferenceKey() {},
        async loadReferenceKey() { return "synthetic-reference"; },
        async setStage() {},
      };
      const model = { async failVerification(input) { calls.push(["persist-failure", input.failureCode]); } };
      const service = createDigilockerService({ provider, stateStore, model, env: { NODE_ENV: "test" } });
      service.registerVerificationHandler("aadhaar", {
        documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "test", stepNumber: 2,
        async retrieveDocument({ provider: idto, referenceKey }) {
          const details = await idto.getUserDetails({ reference_key: referenceKey });
          assert.equal(details.status, "success");
          return idto.fetchAadhaar({ reference_key: referenceKey });
        },
        async verifyAndPersist() { assert.fail("failed provider operation must not reach validation/persistence"); },
      });
      await assert.rejects(
        service.completeCallback({ code: "synthetic-code", code_verifier: VERIFIER, state: STATE }),
        { code: "IDTO_TIMEOUT" },
      );
      assert.equal(calls.at(-1)[0], "persist-failure");
      assert.equal(calls.at(-1)[1], "IDTO_TIMEOUT");
      if (failedOperation !== "fetch_aadhaar") assert.equal(calls.some(([name]) => name === "fetch_aadhaar"), false);
    });
  }
});

test("initiation creates bound state and sends only documented consent fields", async () => {
  let captured;
  const preparedAuthorization = {
    state: STATE,
    stateHash: createHash("sha256").update(STATE).digest("hex"),
    sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    expiresIn: 600,
    expiresAt: new Date(Date.now() + 600_000),
  };
  const model = {
    async createPendingVerification(userId, verificationType, authorization) {
      assert.equal(userId, "52");
      assert.equal(verificationType, "aadhaar");
      assert.deepEqual(authorization, preparedAuthorization);
      return { userId: "52", caseId: "13", verificationId: "31", authorizationSessionId: SESSION };
    },
    async failVerification() { assert.fail("successful initiation must not fail"); },
  };
  const stateStore = {
    prepareAuthorizationState() {
      return preparedAuthorization;
    },
    async saveInitiationResponse(sessionId, response) {
      assert.equal(sessionId, "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa");
      assert.equal(response.code, 1000);
    },
    async discardAuthorizationState() { return true; },
  };
  const provider = {
    mode: "idto",
    async initiateSession(body) {
      captured = body;
      return { status: "success", code: 1000, url: `https://digilocker.idto.ai/authorize?state=${STATE}` };
    },
  };
  const service = createDigilockerService({
    provider, model, stateStore,
    env: { IDTO_REDIRECT_URL: "https://api.example.test/api/kyc/digilocker/callback" },
  });
  service.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "AquaPay KYC", stepNumber: 2,
    async retrieveDocument() {}, async verifyAndPersist() {},
  });
  const result = await service.initiateAuthorization("52", "aadhaar", { consent: true });
  assert.equal(result.authorizationUrl, `https://digilocker.idto.ai/authorize?state=${STATE}`);
  assert.equal(result.sessionId, "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa");
  assert.equal(result.status, "PENDING");
  assert.deepEqual(captured, {
    consent: true,
    consent_purpose: "AquaPay KYC",
    redirect_url: "https://api.example.test/api/kyc/digilocker/callback",
    redirect_to_signup: false,
    documents_for_consent: ["ADHAR"],
    state: STATE,
  });
});

test("fetch_aadhaar maps documented HTTP errors and rejects a JSON error body on HTTP 200", async () => {
  for (const [status, code] of [
    [403, "CONSENT_NOT_PROVIDED"],
    [404, "DOC_NOT_FOUND"],
    [410, "REFERENCE_KEY_EXPIRED"],
    [500, "DOC_UNAVAILABLE"],
  ]) {
    const provider = createRealDigilockerProvider({
      env: PROVIDER_CONFIG,
      fetchImpl: async () => jsonResponse({ private: "synthetic sensitive payload" }, status),
    });
    await assert.rejects(provider.fetchAadhaar({ reference_key: "opaque" }), (error) => {
      assert.equal(error.code, code);
      assert.equal(error.statusCode, status);
      assert.equal(error.message.includes("sensitive"), false);
      return true;
    });
  }
  const jsonError = createRealDigilockerProvider({
    env: PROVIDER_CONFIG,
    fetchImpl: async () => jsonResponse({ error: "synthetic provider error" }, 200),
  });
  await assert.rejects(jsonError.fetchAadhaar({ reference_key: "opaque" }), {
    code: "IDTO_AADHAAR_UNEXPECTED_JSON_RESPONSE",
    statusCode: 200,
  });
});

test("provider timeout is sanitized", async () => {
  const provider = createRealDigilockerProvider({
    env: PROVIDER_CONFIG,
    fetchImpl: async () => { const error = new Error("synthetic transport timeout"); error.name = "AbortError"; throw error; },
  });
  await assert.rejects(provider.fetchAadhaar({ reference_key: "synthetic-reference" }), (error) => {
    assert.equal(error.code, "IDTO_TIMEOUT");
    assert.equal(error.message.includes("synthetic transport timeout"), false);
    return true;
  });
});

test("additive MySQL migration persists DigiLocker session ownership, expiry, state and encrypted reference fields", () => {
  const migration = readFileSync(new URL("../../../../../../database/migrations/008_digilocker_kyc_sessions.sql", import.meta.url), "utf8");
  for (const token of [
    "CREATE TABLE IF NOT EXISTS kyc_digilocker_sessions",
    "user_id BIGINT UNSIGNED NOT NULL",
    "case_id BIGINT UNSIGNED NOT NULL",
    "verification_id BIGINT UNSIGNED NOT NULL",
    "authorization_state_hash CHAR(64)",
    "authorization_code_hash CHAR(64)",
    "code_verifier_hash CHAR(64)",
    "state_expires_at DATETIME(3)",
    "reference_key_ciphertext MEDIUMBLOB",
    "reference_key_iv BINARY(12)",
    "reference_key_authentication_tag BINARY(16)",
    "FOREIGN KEY (user_id) REFERENCES users(id)",
    "FOREIGN KEY (case_id) REFERENCES kyc_cases(id)",
  ]) assert.ok(migration.includes(token), `missing schema contract ${token}`);
  assert.equal(/ALTER\s+TABLE\s+(users|kyc_cases|kyc_steps|kyc_verifications)/i.test(migration), false);
  assert.equal(/FOREIGN KEY \(verification_id\) REFERENCES kyc_verifications\(id\)\s+ON DELETE CASCADE/i.test(migration), false);
  assert.match(migration, /verification_id is the base column of active_verification_id/i);
});

test("Aadhaar shared callback gets reference, user details, then fetches raw XML before persistence", async () => {
  const calls = [];
  const provider = {
    mode: "idto",
    async getReference(body) { calls.push(["get_reference", body]); return { status: "success", reference_key: "synthetic-reference" }; },
    async getUserDetails(body) { calls.push(["user_details", body]); return { schema: "provider-defined" }; },
    async fetchAadhaar(body) { calls.push(["fetch_aadhaar", body]); return "<synthetic-xml/>"; },
  };
  const store = { async consumeAuthorizationState() {
    calls.push(["consume_state"]);
    return {
      userId: "52", caseId: "13", verificationId: "31", digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
      authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"), verificationType: "aadhaar",
    };
  }, async saveReferenceKey(attempt, referenceKey) {
    assert.equal(attempt.verificationId, "31");
    assert.equal(referenceKey, "synthetic-reference");
    calls.push(["persist_reference_key"]);
  }, async loadReferenceKey() { return "synthetic-reference"; }, async setStage() {} };
  const model = {
    async completeVerification() {
      calls.push(["persist"]);
      return { stepNumber: 2, steps_completed: 2 };
    },
    async failVerification() { calls.push(["fail"]); },
  };
  const service = createDigilockerService({ provider, stateStore: store, model, env: { NODE_ENV: "test" } });
  service.registerVerificationHandler("aadhaar", {
    documentCode: "ADHAR", issuerId: "in.gov.uidai", consentPurpose: "test consent", stepNumber: 2,
    async retrieveDocument({ provider: p, referenceKey, reportProviderStage }) {
      reportProviderStage("provider_user_details", "user_details");
      await p.getUserDetails({ reference_key: referenceKey });
      reportProviderStage("provider_fetch_aadhaar", "fetch_aadhaar");
      return p.fetchAadhaar({ reference_key: referenceKey });
    },
    async verifyAndPersist({ xml }) {
      assert.equal(xml, "<synthetic-xml/>");
      calls.push(["validate_and_persist"]);
      return {
        extracted: { maskedIdentifier: "XXXXXX1234", verifiedName: "Synthetic Person", signatureVerified: true, developmentOnly: false, verificationMode: "issuer_certificate" },
        completion: { stepNumber: 2, steps_completed: 2 },
      };
    },
  });

  const result = await service.completeCallback({ code: "authorization-code", code_verifier: VERIFIER, state: STATE });
  assert.deepEqual(calls.map(([name]) => name), ["consume_state", "get_reference", "persist_reference_key", "user_details", "fetch_aadhaar", "validate_and_persist"]);
  assert.deepEqual(calls.find(([name]) => name === "get_reference")[1], {
    code: "authorization-code", code_verifier: VERIFIER,
  });
  assert.equal(result.verificationStatus, "verified");
  assert.equal(result.maskedIdentifier, "XXXXXX1234");
});

test("development callback logs bounded Aadhaar XML diagnostics and never logs document contents", async () => {
  const logs = [];
  const calls = [];
  const logger = { error: (...args) => logs.push(args) };
  const provider = {
    mode: "idto",
    async getReference() { return { status: "success", reference_key: "synthetic-reference" }; },
    async getUserDetails(_body, options) {
      options?.onResponseMeta?.({ httpStatus: 200, contentType: "application/json", responseFormat: "json" });
      return { status: "success" };
    },
    async fetchAadhaar(_body, options) {
      options?.onResponseMeta?.({
        httpStatus: 200,
        contentType: "application/xml",
        responseFormat: "xml",
        contentLengthBytes: Buffer.byteLength(UIDAI_FAILURE_XML),
      });
      return UIDAI_FAILURE_XML;
    },
  };
  const stateStore = {
    async consumeAuthorizationState() {
      return {
        userId: "52", caseId: "13", verificationId: "31", digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
        authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"),
        verificationType: "aadhaar",
      };
    },
    async saveReferenceKey() {},
    async loadReferenceKey() { return "synthetic-reference"; },
    async setStage() {},
  };
  const digilocker = createDigilockerService({
    provider,
    stateStore,
    model: {
      async failVerification() { calls.push("failed"); },
      async completeVerification() { calls.push("completed"); return { stepNumber: 2, steps_completed: 2 }; },
    },
    env: { NODE_ENV: "development" },
    logger,
  });
  createAadhaarService({
    digilocker,
    model: { async completeVerification() { calls.push("completed"); } },
    identityModel: { async persistVerifiedIdentity() { calls.push("persisted"); } },
    validateDocument(xml, options) {
      return validateAadhaarXml(xml, {
        ...options,
        env: {
          NODE_ENV: "development",
          IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
          IDTO_PROVIDER_MODE: "idto",
          IDTO_DEV_UNVERIFIED_DATABASE: "true",
          DB_HOST: "127.0.0.1",
          DB_NAME: "fintech_kyc",
        },
      });
    },
  });

  await assert.rejects(
    digilocker.completeCallback({ code: "synthetic-authorization-code", code_verifier: VERIFIER, state: STATE }),
    { code: "INVALID_AADHAAR_DOCUMENT" },
  );
  assert.deepEqual(calls, ["failed"]);
  assert.equal(logs.length, 1);
  const [, diagnostic] = logs[0];
  assert.equal(diagnostic.stage, "aadhaar_xml_validation");
  assert.equal(diagnostic.providerEndpoint, null);
  assert.equal(diagnostic.httpStatus, 200);
  assert.equal(diagnostic.contentType, "application/xml");
  assert.equal(diagnostic.documentDiagnostics.kycResponseStatusClassification, "failure");
  assert.equal(diagnostic.documentDiagnostics.validationFailureReason, "kyc_result_not_successful");
  assert.deepEqual(diagnostic.documentDiagnostics.elementAttributeNames.Poi, ["dob", "gender", "name"]);
  const serialized = JSON.stringify(logs);
  for (const sensitive of [
    UIDAI_FAILURE_XML,
    "999999999999",
    "Synthetic UIDAI Person",
    "01-01-1990",
    "Sample Road",
    "synthetic-authorization-code",
    VERIFIER,
    STATE,
    "synthetic-reference",
  ]) assert.equal(serialized.includes(sensitive), false);
});

test("masked Limited KYC UID completes through Aadhaar service and persists only a masked encrypted-payload field", async () => {
  const logs = [];
  const persisted = [];
  const attempt = {
    userId: "52", caseId: "13", verificationId: "31",
    digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    authorizationSessionHash: createHash("sha256").update(SESSION).digest("hex"),
    verificationType: "aadhaar",
  };
  const completeVerification = async (input) => {
    await input.persistIdentity({}, {
      userId: attempt.userId,
      caseId: attempt.caseId,
      verificationId: attempt.verificationId,
      verificationType: "aadhaar",
      verifiedName: input.verifiedName,
    });
    return { stepNumber: 2, steps_completed: 2 };
  };
  const service = createDigilockerService({
    provider: {
      mode: "idto",
      async getReference() { return { status: "success", reference_key: "synthetic-reference" }; },
      async getUserDetails() { return { status: "success" }; },
      async fetchAadhaar() { return MASKED_UID_XML; },
    },
    stateStore: {
      async consumeAuthorizationState() { return attempt; },
      async saveReferenceKey() {},
      async loadReferenceKey() { return "synthetic-reference"; },
      async setStage() {},
    },
    model: {
      async failVerification() {},
      async completeVerification(input) { return completeVerification(input); },
    },
    env: { NODE_ENV: "development" },
    logger: { error: (...args) => logs.push(args) },
  });
  createAadhaarService({
    digilocker: service,
    model: { completeVerification },
    identityModel: {
      async persistVerifiedIdentity(_connection, input) { persisted.push(input); },
    },
  });

  const result = await service.completeCallback({
    code: "synthetic-authorization-code", code_verifier: VERIFIER, state: STATE,
  });

  assert.equal(result.verificationStatus, "verified");
  assert.equal(result.maskedIdentifier, "XXXXXX9012");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].aadhaarNumber, undefined);
  assert.equal(persisted[0].aadhaarMaskedIdentifier, "XXXXXX9012");
  assert.equal(logs.length, 0);
  const serialized = JSON.stringify({ result, persisted, logs });
  for (const sensitive of [MASKED_UID_XML, "xxxxxx9012", "123456789012", VERIFIER, STATE, "synthetic-reference"]) {
    assert.equal(serialized.includes(sensitive), false);
  }
});

test("missing or consumed authorization state stops before provider calls", async () => {
  let providerCalls = 0;
  const service = createDigilockerService({
    provider: { async getReference() { providerCalls += 1; } },
    stateStore: { async consumeAuthorizationState() { return null; } },
    model: { async failVerification() {} },
    env: { NODE_ENV: "test" },
  });
  await assert.rejects(service.completeCallback({ code: "authorization-code", code_verifier: VERIFIER, state: STATE }), {
    code: "INVALID_OR_EXPIRED_STATE",
  });
  assert.equal(providerCalls, 0);
});

test("successful Aadhaar persistence atomically completes verification, step, case progress, and MySQL session without a signature claim", async () => {
  const calls = [];
  const authorizationSessionHash = createHash("sha256").update(SESSION).digest("hex");
  const providerReference = `aquapay-digilocker:${authorizationSessionHash}`;
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute(sql, params = []) {
      calls.push({ sql, params });
      if (sql.includes("FROM users")) return [[{ id: "52", status: "active" }]];
      if (sql.includes("FROM kyc_cases")) return [[{ id: "13", status: "pending" }]];
      if (sql.includes("SELECT COUNT(*) AS steps_completed")) return [[{ steps_completed: 2 }]];
      if (sql.includes("FROM kyc_steps") && sql.includes("step_number = ?")) {
        return Number(params[1]) === 1
          ? [[{ status: "completed" }]]
          : [[{ id: "21", status: "in_progress" }]];
      }
      if (sql.includes("FROM kyc_verifications")) {
        return [[{ id: "31", status: "pending", provider_reference: providerReference }]];
      }
      if (sql.includes("FROM kyc_digilocker_sessions")) {
        return [[{
          status: "processing",
          authorization_session_hash: authorizationSessionHash,
          authorization_code_hash: createHash("sha256").update("synthetic-code").digest("hex"),
          code_verifier_hash: createHash("sha256").update(VERIFIER).digest("hex"),
        }]];
      }
      return [{ affectedRows: 1 }];
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const model = createDigilockerModel({ dbPool: { async getConnection() { return connection; } }, env: { NODE_ENV: "test" } });
  let persisted = false;
  const result = await model.completeVerification({
    userId: "52", caseId: "13", verificationId: "31",
    digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    authorizationSessionHash,
    verificationType: "aadhaar",
    maskedIdentifier: "XXXXXX1234",
    verifiedName: "Synthetic Person",
    async persistIdentity(_connection, context) {
      persisted = true;
      assert.equal(context.verificationType, "aadhaar");
      assert.equal(context.userId, "52");
    },
  });
  assert.equal(persisted, true);
  assert.deepEqual(result, { verificationType: "aadhaar", stepNumber: 2, steps_completed: 2 });
  assert.equal(calls[0], "begin");
  assert.equal(calls.at(-2), "commit");
  assert.equal(calls.at(-1), "release");
  assert.equal(calls.some((call) => call === "rollback"), false);
  const updates = calls.filter((call) => call && typeof call === "object").map(({ sql, params }) => ({ sql, params }));
  assert.ok(updates.some(({ sql, params }) => sql.includes("UPDATE kyc_verifications") && params[0] === "idto_digilocker_v1"));
  assert.ok(updates.some(({ sql, params }) => sql.includes("UPDATE kyc_steps") && params[0] === "13"));
  assert.ok(updates.some(({ sql }) => sql.includes("UPDATE kyc_cases") && sql.includes("steps_completed")));
  assert.ok(updates.some(({ sql }) => sql.includes("UPDATE kyc_digilocker_sessions") && sql.includes("status = 'verified'")));
});

test("identity persistence failure rolls back verification and KYC progress transaction", async () => {
  const calls = [];
  const providerReference = `aquapay-digilocker:${createHash("sha256").update(SESSION).digest("hex")}`;
  const connection = {
    async beginTransaction() { calls.push("begin"); },
    async execute(sql, params = []) {
      if (sql.includes("FROM users")) return [[{ id: "52", status: "active" }]];
      if (sql.includes("FROM kyc_cases")) return [[{ id: "13", status: "pending" }]];
      if (sql.includes("FROM kyc_steps") && sql.includes("step_number = ?")) {
        const isPrerequisite = Number(params[1]) === 1;
        return [isPrerequisite ? [{ status: "completed" }] : [{ id: "21", status: "in_progress" }]];
      }
      if (sql.includes("FROM kyc_verifications")) {
        return [[{ id: "31", status: "pending", provider_reference: providerReference }]];
      }
      if (sql.includes("FROM kyc_digilocker_sessions")) {
        return [[{
          status: "processing",
          authorization_session_hash: createHash("sha256").update(SESSION).digest("hex"),
          authorization_code_hash: createHash("sha256").update("synthetic-code").digest("hex"),
          code_verifier_hash: createHash("sha256").update(VERIFIER).digest("hex"),
        }]];
      }
      if (sql.includes("UPDATE kyc_verifications") || sql.includes("UPDATE kyc_steps") || sql.includes("UPDATE kyc_cases")) {
        calls.push("progress-update");
      }
      return [[], []];
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); },
  };
  const model = createDigilockerModel({ dbPool: { async getConnection() { return connection; } }, env: { NODE_ENV: "test" } });
  await assert.rejects(model.completeVerification({
    userId: "52", caseId: "13", verificationId: "31", digilockerSessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
    authorizationSessionId: SESSION,
    verificationType: "aadhaar", maskedIdentifier: "XXXXXX1234", verifiedName: "Synthetic Person",
    async persistIdentity() { throw new Error("synthetic identity persistence failure"); },
  }), /synthetic identity persistence failure/);
  assert.deepEqual(calls, ["begin", "rollback", "release"]);
  assert.equal(calls.includes("commit"), false);
  assert.equal(calls.includes("progress-update"), false);
});
