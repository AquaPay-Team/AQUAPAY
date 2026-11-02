import "../../../auth/setupEnv.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createDigilockerProvider } from "../digilocker/digilocker.provider.js";
import { createDigilockerStateStore } from "../digilocker/digilockerStateStore.js";
import { createDigilockerService } from "../digilocker/digilocker.service.js";
import { validateCallbackQuery } from "../digilocker/digilocker.validator.js";
import { createPanModel } from "./pan.model.js";
import { createPanService } from "./pan.service.js";
import { parsePanFields, validatePanXml } from "./pan.validator.js";

const FIXTURES = fileURLToPath(new URL("../digilocker/fixtures/", import.meta.url));
const CERTIFICATE = `${FIXTURES}/mock-signing-cert.crt`;
const EXPIRED_CERTIFICATE = `${FIXTURES}/mock-expired-signing-cert.crt`;
const SIGNATURE_BYPASS_ENV = Object.freeze({
  NODE_ENV: "development",
  IDTO_PROVIDER_MODE: "idto",
  IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
  IDTO_DEV_UNVERIFIED_DATABASE: "true",
  DB_HOST: "127.0.0.1",
  DB_NAME: "fintech_kyc",
});
const readFixture = () => fs.readFileSync(`${FIXTURES}/pan.xml`, "utf8");

process.env.NODE_ENV = "test";
process.env.IDTO_PROVIDER_MODE = "idto";
process.env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION = "false";
process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH = CERTIFICATE;

test("PAN module verifies its signed PANCR fixture and rejects tampering or another document type", () => {
  const xml = readFixture();
  assert.deepEqual(validatePanXml(xml), {
    panNumber: "AAAAA0000A",
    maskedIdentifier: "XXXXXX000A",
    verifiedName: "AquaPay Mock PAN",
    signatureVerified: true,
    developmentOnly: false,
    verificationMode: "issuer_certificate",
  });
  assert.throws(() => validatePanXml(xml.replace("AquaPay Mock PAN", "Tampered Name")), {
    code: "INVALID_DOCUMENT_SIGNATURE",
  });
  assert.throws(() => validatePanXml(xml.replace('type="PANCR"', 'type="ADHAR"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => validatePanXml(xml.replace(/<Signature\b[\s\S]*?<\/Signature>/, "")), {
    code: "INVALID_DOCUMENT_SIGNATURE",
  });
  assert.throws(() => validatePanXml("<Certificate type=\"PANCR\"><IssuedTo>"), {
    code: "INVALID_PAN_DOCUMENT",
  });
});

test("PAN development bypass skips only cryptography; XML, type, PAN, and name validation remain active", () => {
  const unsigned = readFixture().replace(/<Signature\b[\s\S]*?<\/Signature>/, "");
  assert.deepEqual(validatePanXml(unsigned, { env: SIGNATURE_BYPASS_ENV }), {
    panNumber: "AAAAA0000A",
    maskedIdentifier: "XXXXXX000A",
    verifiedName: "AquaPay Mock PAN",
    signatureVerified: false,
    developmentOnly: true,
    verificationMode: "development_unverified",
  });
  assert.throws(() => validatePanXml("<Certificate type=\"PANCR\"><IssuedTo>" , { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => validatePanXml(unsigned.replace('type="PANCR"', 'type="ADHAR"'), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => validatePanXml(unsigned.replace('num="AAAAA0000A"', 'num="BAD"'), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => validatePanXml(unsigned.replace('<Person name="AquaPay Mock PAN" gender="M"/>', '<Person gender="M"/>'), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_PAN_DOCUMENT",
  });
});

test("PAN parser validates identifier consistency, date, and required identity fields", () => {
  const xml = readFixture();
  assert.throws(() => parsePanFields(xml.replace('num="AAAAA0000A"', 'num="BBBBB1111B"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace('number="AAAAA0000A"', 'number="BBBBB1111B"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace('num="AAAAA0000A"', 'num="BAD"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace('verifiedOn="01-01-2025 00:00:00"', 'verifiedOn="31-02-2025 00:00:00"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace('<Person name="AquaPay Mock PAN" gender="M"/>', '<Person gender="M"/>')), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace("Income Tax Department", "Untrusted Issuer")), {
    code: "INVALID_PAN_DOCUMENT",
  });
  assert.throws(() => parsePanFields(xml.replace('type="CG"', 'type="SG"')), {
    code: "INVALID_PAN_DOCUMENT",
  });
});

test("PAN verification fails closed when its pinned certificate is missing or expired", () => {
  const oldMode = process.env.IDTO_PROVIDER_MODE;
  const oldPath = process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH;
  process.env.IDTO_PROVIDER_MODE = "idto";
  try {
    delete process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH;
    assert.throws(() => validatePanXml(readFixture()), { code: "SIGNING_CERTIFICATE_NOT_CONFIGURED" });
    process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH = EXPIRED_CERTIFICATE;
    assert.throws(() => validatePanXml(readFixture()), { code: "SIGNING_CERTIFICATE_NOT_CONFIGURED" });
  } finally {
    if (oldMode === undefined) delete process.env.IDTO_PROVIDER_MODE;
    else process.env.IDTO_PROVIDER_MODE = oldMode;
    if (oldPath === undefined) delete process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH;
    else process.env.IDTO_PAN_XML_TRUSTED_CERT_PATH = oldPath;
  }
});

class FakeRedis {
  constructor() { this.values = new Map(); }
  async set(key, value, { EX, NX }) {
    if (NX && this.values.has(key)) return null;
    this.values.set(key, { value, expiresAt: Date.now() + EX * 1000 });
    return "OK";
  }
  async eval(_script, { keys }) {
    const value = this.values.get(keys[0]);
    if (!value || value.expiresAt <= Date.now()) return false;
    this.values.delete(keys[0]);
    return value.value;
  }
  async del(key) { return this.values.delete(key) ? 1 : 0; }
}

function makeModel({ rejectInitiation = false } = {}) {
  const persisted = [];
  const failures = [];
  return {
    persisted,
    failures,
    async createPendingVerification(userId, verificationType) {
      if (rejectInitiation) throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
      return {
        userId: String(userId),
        caseId: "11",
        verificationId: "24",
        authorizationSessionId: "p".repeat(43),
        verificationType,
      };
    },
    async completeVerification(input) {
      persisted.push(input);
      return { stepNumber: 3, steps_completed: 3 };
    },
    async failVerification(input) { failures.push(input); },
  };
}

function makeMockEngine(model, providerOverride = undefined) {
  process.env.NODE_ENV = "test";
  process.env.IDTO_PROVIDER_MODE = "mock";
  process.env.IDTO_MOCK_SIGNING_CERT_PATH = CERTIFICATE;
  const env = {
    NODE_ENV: "test",
    IDTO_PROVIDER_MODE: "mock",
    IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000",
  };
  const baseProvider = createDigilockerProvider({ env });
  const provider = providerOverride ? providerOverride(baseProvider) : baseProvider;
  const redis = new FakeRedis();
  const stateStore = createDigilockerStateStore({ getRedisClient: async () => redis, env });
  const shared = createDigilockerService({ provider, model, stateStore, env });
  return { shared, provider };
}

test("PAN initiation is rejected by the existing Aadhaar prerequisite", async () => {
  const model = makeModel({ rejectInitiation: true });
  const { shared } = makeMockEngine(model);
  const pan = createPanService({ digilocker: shared, model });
  await assert.rejects(
    pan.initiateVerification("7", { consent: true }),
    { code: "KYC_PREREQUISITE_NOT_COMPLETED" },
  );
  assert.equal(model.persisted.length, 0);
});

test("PAN Step 3 completes end to end through its service and the shared mock engine", async () => {
  const model = makeModel();
  const { shared, provider } = makeMockEngine(model);
  const identityWrites = [];
  const pan = createPanService({
    digilocker: shared,
    model,
    identityModel: {
      async persistVerifiedIdentity(_connection, identity) { identityWrites.push(identity); },
    },
  });
  const initiation = await pan.initiateVerification("7", { consent: true });
  assert.equal(initiation.verificationType, "pan");
  assert.equal(initiation.stepNumber, 3);
  const authorizationUrl = new URL(initiation.authorizationUrl);
  assert.equal(authorizationUrl.searchParams.get("document"), "PANCR");
  const callback = provider.getMockCallbackParameters({
    state: authorizationUrl.searchParams.get("state"),
    document: "PANCR",
  });
  const completed = await shared.completeCallback(validateCallbackQuery(callback));

  assert.equal(completed.verificationStatus, "verified");
  assert.equal(completed.stepNumber, 3);
  assert.equal(completed.maskedIdentifier, "XXXXXX000A");
  assert.equal(model.persisted.length, 1);
  assert.equal(model.persisted[0].verificationType, "pan");
  await model.persisted[0].persistIdentity({}, {
    userId: "7", caseId: "11", verificationId: "24", verificationType: "pan",
  });
  assert.deepEqual(identityWrites[0], {
    userId: "7", caseId: "11", verificationId: "24", verificationType: "pan", panNumber: "AAAAA0000A",
  });
  assert.equal(Object.hasOwn(completed, "panNumber"), false);
  assert.equal(JSON.stringify(completed).includes("AAAAA0000A"), false);
  assert.deepEqual(model.failures, []);
});

test("invalid signed PAN XML fails the attempt and never persists or completes Step 3", async () => {
  const model = makeModel();
  const { shared, provider: baseProvider } = makeMockEngine(model, (base) => ({
    ...base,
    getIssuedDocsXml: async () => readFixture().replace("AquaPay Mock PAN", "Tampered PAN"),
  }));
  const pan = createPanService({ digilocker: shared, model });
  const initiation = await pan.initiateVerification("7", { consent: true });
  const authorizationUrl = new URL(initiation.authorizationUrl);
  const callback = baseProvider.getMockCallbackParameters({
    state: authorizationUrl.searchParams.get("state"),
    document: "PANCR",
  });

  await assert.rejects(
    shared.completeCallback(validateCallbackQuery(callback)),
    { code: "INVALID_VERIFICATION_DOCUMENT" },
  );
  assert.equal(model.persisted.length, 0);
  assert.equal(model.failures.length, 1);
  assert.equal(model.failures[0].verificationType, "pan");
});

test("real-IDTO mode returns development_unverified after PAN-specific validation", async () => {
  const state = "t".repeat(43);
  const attempt = {
    userId: "7",
    caseId: "11",
    verificationId: "24",
    authorizationSessionId: "p".repeat(43),
    verificationType: "pan",
  };
  const persisted = [];
  const persistedIdentities = [];
  const provider = {
    mode: "idto",
    async initiateSession(body) {
      assert.equal(body.documents_for_consent[0], "PANCR");
      return { status: "success", code: 1000, url: `https://digilocker.idto.ai/authorize?state=${body.state}` };
    },
    async getReference() {
      return { status: "success", reference_key: "reference_pan", expires_at: "2099-01-01T00:00:00Z" };
    },
    async getIssuedDocs() {
      return { status: "success", issued_docs: { items: [
        { type: "file", doctype: "PANCR", issuerid: "in.gov.pan", uri: "pan.xml", mime: ["application/xml"] },
      ] } };
    },
    async getIssuedDocsXml() {
      return readFixture().replace(/<Signature\b[\s\S]*?<\/Signature>/, "");
    },
  };
  const model = {
    async createPendingVerification() { return attempt; },
    async completeVerification(input) {
      persisted.push(input);
      return { stepNumber: 3, steps_completed: 3 };
    },
    async failVerification() { assert.fail("valid PAN fields should complete in development mode"); },
  };
  const stateStore = {
    async createAuthorizationState() { return { state, expiresIn: 600 }; },
    async consumeAuthorizationState(value) { return value === state ? attempt : null; },
    async discardAuthorizationState() { return true; },
  };
  const env = {
    ...SIGNATURE_BYPASS_ENV,
    IDTO_REDIRECT_URL: "https://aquapay.example/api/kyc/digilocker/callback",
  };
  const shared = createDigilockerService({ provider, model, stateStore, env });
  const pan = createPanService({
    digilocker: shared,
    model,
    identityModel: {
      async persistVerifiedIdentity(_connection, identity) { persistedIdentities.push(identity); },
    },
    validateDocument: (xml) => validatePanXml(xml, { env }),
  });

  await pan.initiateVerification("7", { consent: true });
  const result = await shared.completeCallback({ code: "oauth", code_verifier: "v".repeat(43), state });
  assert.equal(result.verificationStatus, "development_unverified");
  assert.equal(result.signatureVerified, false);
  assert.equal(result.developmentOnly, true);
  assert.equal(persisted[0].signatureVerified, false);
  assert.equal(persisted[0].maskedIdentifier, "XXXXXX000A");
  await persisted[0].persistIdentity({}, {
    ...attempt,
  });
  assert.equal(persistedIdentities[0].panNumber, "AAAAA0000A");
});

test("PAN model persists only the validated full PAN into the encrypted identity store", async () => {
  const persisted = [];
  const model = createPanModel({
    identityModel: {
      async insertIdentityData(connection, input) { persisted.push({ connection, input }); },
    },
  });
  const connection = {};
  await model.persistVerifiedIdentity(connection, {
    userId: "7",
    caseId: "11",
    verificationId: "24",
    verificationType: "pan",
    panNumber: "AAAAA0000A",
  });
  assert.deepEqual(persisted, [{
    connection,
    input: {
      userId: "7",
      caseId: "11",
      verificationId: "24",
      identityType: "pan",
      payload: { panNumber: "AAAAA0000A" },
    },
  }]);
});
