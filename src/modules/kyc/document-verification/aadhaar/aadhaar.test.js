import "../../../auth/setupEnv.js";
import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { createDigilockerProvider } from "../digilocker/digilocker.provider.js";
import { createDigilockerStateStore } from "../digilocker/digilockerStateStore.js";
import { createDigilockerService } from "../digilocker/digilocker.service.js";
import { validateCallbackQuery } from "../digilocker/digilocker.validator.js";
import { createAadhaarModel } from "./aadhaar.model.js";
import { createAadhaarService } from "./aadhaar.service.js";
import { parseAadhaarFields, validateAadhaarXml } from "./aadhaar.validator.js";

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
const readFixture = () => fs.readFileSync(`${FIXTURES}/aadhaar.xml`, "utf8");
const EXPECTED_AADHAAR_FIELDS = Object.freeze({
  aadhaarNumber: "999999999999",
  maskedIdentifier: "XXXXXX9999",
  verifiedName: "AquaPay Mock Aadhaar",
  address: [{
    type: "permanent",
    line1: "42 Example Road",
    line2: "Unit 7",
    house: "42",
    landmark: "Test Park",
    locality: "Mock Layout",
    vtc: "Fictional Town",
    district: "Test District",
    pin: "000000",
    state: "Test State",
    country: "IN",
  }],
  dateOfBirth: "1990-01-01",
});

process.env.NODE_ENV = "test";
process.env.IDTO_PROVIDER_MODE = "idto";
process.env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION = "false";
process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH = CERTIFICATE;

test("Aadhaar module verifies its signed ADHAR fixture and rejects tampering", () => {
  const xml = readFixture();
  assert.deepEqual(validateAadhaarXml(xml), {
    ...EXPECTED_AADHAAR_FIELDS,
    signatureVerified: true,
    developmentOnly: false,
    verificationMode: "issuer_certificate",
  });

  assert.throws(() => validateAadhaarXml(xml.replace("AquaPay Mock Aadhaar", "Tampered Name")), {
    code: "INVALID_DOCUMENT_SIGNATURE",
  });
  const brokenSignature = xml.replace(/(<SignatureValue>)([^<])/, (_match, start, character) =>
    `${start}${character === "A" ? "B" : "A"}`,
  );
  assert.throws(() => validateAadhaarXml(brokenSignature), { code: "INVALID_DOCUMENT_SIGNATURE" });
  assert.throws(() => validateAadhaarXml(xml.replace(/<Signature\b[\s\S]*?<\/Signature>/, "")), {
    code: "INVALID_DOCUMENT_SIGNATURE",
  });
  assert.throws(() => validateAadhaarXml(xml.replace('type="ADHAR"', 'type="PANCR"')), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => validateAadhaarXml("<Certificate type=\"ADHAR\"><IssuedTo>"), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
});

test("Aadhaar parser validates only its required identity fields and supports DigiLocker PullDocResponse", () => {
  const xml = readFixture();
  assert.throws(() => parseAadhaarFields(xml.replace('uid="999999999999"', 'uid="1234"')), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => parseAadhaarFields(xml.replace('name="AquaPay Mock Aadhaar"', "")), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => parseAadhaarFields(xml.replace('dob="01-01-1990"', "")), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => parseAadhaarFields(xml.replace(/<Address\b[^>]*\/>/, "")), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => parseAadhaarFields(xml.replace("Unique Identification Authority of India", "Untrusted Issuer")), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });

  const wrapped = `<PullDocResponse><ResponseStatus status="1"/><DocDetails><DataContent>${Buffer.from(xml).toString("base64")}</DataContent></DocDetails></PullDocResponse>`;
  const wrapperDiagnostics = [];
  assert.deepEqual(validateAadhaarXml(wrapped, {
    onValidationDiagnostic: (metadata) => wrapperDiagnostics.push(metadata),
  }), {
    ...EXPECTED_AADHAAR_FIELDS,
    signatureVerified: true,
    developmentOnly: false,
    verificationMode: "issuer_certificate",
  });
  const wrapperSummary = wrapperDiagnostics.find((metadata) => metadata.validationStage === "aadhaar_document_structure");
  assert.equal(wrapperSummary.providerDocumentFormat, "pull_doc_response_xml");
  assert.equal(wrapperSummary.providerXmlRootElementName, "PullDocResponse");
  assert.equal(wrapperSummary.xmlRootElementName, "Certificate");
  assert.throws(() => validateAadhaarXml(wrapped.replace('status="1"', 'status="0"')), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
});

test("PullDocResponse failures expose only the exact structural check in safe diagnostics", () => {
  const encodedXml = Buffer.from(readFixture()).toString("base64");
  const fixtures = [
    {
      reason: "response_status_count_invalid",
      xml: `<PullDocResponse><DocDetails><DataContent>${encodedXml}</DataContent></DocDetails></PullDocResponse>`,
      checks: { responseStatusCount: 0, responseStatusSuccess: false, docDetailsCount: 1, dataContentCount: 1, dataContentNonEmpty: true },
    },
    {
      reason: "response_status_not_success",
      xml: `<PullDocResponse><ResponseStatus status="0"/><DocDetails><DataContent>${encodedXml}</DataContent></DocDetails></PullDocResponse>`,
      checks: { responseStatusCount: 1, responseStatusSuccess: false, docDetailsCount: 1, dataContentCount: 1, dataContentNonEmpty: true },
    },
    {
      reason: "doc_details_count_invalid",
      xml: `<PullDocResponse><ResponseStatus status="1"/><DataContent>${encodedXml}</DataContent></PullDocResponse>`,
      checks: { responseStatusCount: 1, responseStatusSuccess: true, docDetailsCount: 0, dataContentCount: 0, dataContentNonEmpty: false },
    },
    {
      reason: "data_content_count_invalid",
      xml: `<PullDocResponse><ResponseStatus status="1"/><DocDetails/></PullDocResponse>`,
      checks: { responseStatusCount: 1, responseStatusSuccess: true, docDetailsCount: 1, dataContentCount: 0, dataContentNonEmpty: false },
    },
  ];

  for (const fixture of fixtures) {
    const diagnostics = [];
    assert.throws(() => validateAadhaarXml(fixture.xml, {
      env: SIGNATURE_BYPASS_ENV,
      onValidationDiagnostic: (metadata) => diagnostics.push(metadata),
    }), { code: "INVALID_AADHAAR_DOCUMENT" });
    const structure = diagnostics.find((metadata) => metadata.validationStage === "pull_doc_response_structure");
    assert.equal(structure.validationFailureReason, fixture.reason);
    assert.deepEqual(structure.pullDocResponseChecks, fixture.checks);
    assert.doesNotMatch(JSON.stringify(diagnostics), /999999999999|AquaPay Mock Aadhaar|42 Example Road|<Certificate|[A-Za-z0-9+/]{80,}/);
  }
});

test("Aadhaar development bypass skips only cryptography; XML and Aadhaar fields still validate", () => {
  const unsigned = readFixture().replace(/<Signature\b[\s\S]*?<\/Signature>/, "");
  assert.deepEqual(validateAadhaarXml(unsigned, { env: SIGNATURE_BYPASS_ENV }), {
    ...EXPECTED_AADHAAR_FIELDS,
    signatureVerified: false,
    developmentOnly: true,
    verificationMode: "development_unverified",
  });
  assert.throws(() => validateAadhaarXml("<Certificate type=\"ADHAR\"><IssuedTo>" , { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => validateAadhaarXml(unsigned.replace('type="ADHAR"', 'type="PANCR"'), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => validateAadhaarXml(unsigned.replace('uid="999999999999"', 'uid="1234"'), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
  assert.throws(() => validateAadhaarXml(unsigned.replace('name="AquaPay Mock Aadhaar"', ""), { env: SIGNATURE_BYPASS_ENV }), {
    code: "INVALID_AADHAAR_DOCUMENT",
  });
});

test("Aadhaar type mismatch diagnostics identify the failing condition without identity values", () => {
  const wrongTypeXml = readFixture().replace('type="ADHAR"', 'type="PANCR"');
  const diagnostics = [];
  assert.throws(
    () => validateAadhaarXml(wrongTypeXml, {
      env: SIGNATURE_BYPASS_ENV,
      onValidationDiagnostic: (metadata) => diagnostics.push(metadata),
    }),
    { code: "INVALID_AADHAAR_DOCUMENT" },
  );
  const container = diagnostics.find((metadata) => metadata.validationStage === "provider_xml_container");
  const aadhaarStructure = diagnostics.find((metadata) => metadata.validationStage === "aadhaar_document_structure");
  const failure = diagnostics.find((metadata) => metadata.validationStage === "document_type_validation");

  assert.equal(container.documentFormat, "certificate_xml");
  assert.equal(container.xmlRootElementName, "Certificate");
  assert.equal(aadhaarStructure.expectedIssuerPresent, true);
  assert.deepEqual(aadhaarStructure.requiredFieldPresence, {
    issuedTo: true,
    person: true,
    aadhaarNumber: true,
    name: true,
    dateOfBirth: true,
    address: true,
    addressLine1: true,
    addressVtc: true,
    addressState: true,
    addressCountry: true,
  });
  assert.equal(failure.validationFailureReason, "document_type_mismatch");
  assert.equal(failure.xmlRootElementName, "Certificate");
  assert.equal(failure.documentTypeAttributePresent, true);
  assert.equal(failure.documentTypeAttributeLocalNamePresent, true);
  assert.equal(failure.documentTypeAttributeNamespace, null);
  assert.equal(failure.expectedDocumentTypeMatched, false);
  assert.equal(failure.signatureBypassActive, true);
  assert.doesNotMatch(JSON.stringify(diagnostics), /999999999999|AquaPay Mock Aadhaar|42 Example Road|01-01-1990/);

  const namespacedTypeXml = readFixture().replace(
    'type="ADHAR"',
    'xmlns:doc="urn:synthetic:document" doc:type="ADHAR"',
  );
  const namespaceDiagnostics = [];
  assert.throws(
    () => validateAadhaarXml(namespacedTypeXml, {
      env: SIGNATURE_BYPASS_ENV,
      onValidationDiagnostic: (metadata) => namespaceDiagnostics.push(metadata),
    }),
    { code: "INVALID_AADHAAR_DOCUMENT" },
  );
  const namespaceFailure = namespaceDiagnostics.find((metadata) =>
    metadata.validationStage === "document_type_validation",
  );
  assert.equal(namespaceFailure.documentTypeAttributePresent, false);
  assert.equal(namespaceFailure.documentTypeAttributeLocalNamePresent, true);
  assert.equal(namespaceFailure.documentTypeAttributeNamespace, "urn:synthetic:document");
  assert.equal(namespaceFailure.validationFailureReason, "namespaced_document_type_attribute");
});

test("shared callback logs fetched Aadhaar XML metadata and safe type diagnostics", async () => {
  const diagnostics = [];
  const failures = [];
  const xml = readFixture().replace('type="ADHAR"', 'type="PANCR"');
  const attempt = {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    authorizationSessionId: "a".repeat(43),
    verificationType: "aadhaar",
  };
  const provider = {
    async getReference() { return { reference_key: "reference-for-test" }; },
    async getIssuedDocs() {
      return { status: "success", issued_docs: { items: [
        { type: "file", doctype: "ADHAR", issuerid: "in.gov.uidai", uri: "synthetic-uri", mime: ["application/xml"] },
      ] } };
    },
    async getIssuedDocsXml(_body, { onResponseMeta }) {
      onResponseMeta({
        httpStatus: 200,
        contentType: "application/xml",
        responseFormat: "xml",
        jsonRootType: null,
        topLevelPropertyNames: [],
        topLevelValueTypes: {},
        expectedFields: {},
        providerErrorCode: null,
      });
      return xml;
    },
  };
  const model = {
    async failVerification(context) { failures.push(context); },
    async completeVerification() { assert.fail("wrong document type must not persist"); },
  };
  const shared = createDigilockerService({
    env: SIGNATURE_BYPASS_ENV,
    provider,
    model,
    stateStore: { async consumeAuthorizationState() { return attempt; } },
    logger: { error: (...args) => diagnostics.push(args) },
  });
  createAadhaarService({
    digilocker: shared,
    model,
    identityModel: { async persistVerifiedIdentity() { assert.fail("invalid type must not persist"); } },
    validateDocument: (value, options) => validateAadhaarXml(value, {
      ...options,
      env: SIGNATURE_BYPASS_ENV,
    }),
  });

  await assert.rejects(
    shared.completeCallback(
      { code: "synthetic-code", code_verifier: "v".repeat(43), state: "s".repeat(43) },
      { correlationId: "aadhaar-type-test" },
    ),
    { code: "INVALID_VERIFICATION_DOCUMENT" },
  );
  assert.equal(failures.length, 1);
  const diagnostic = diagnostics[0][1];
  assert.equal(diagnostic.correlationId, "aadhaar-type-test");
  assert.equal(diagnostic.stage, "aadhaar_xml_validation");
  assert.equal(diagnostic.providerEndpoint, "get_issued_docs_xml");
  assert.equal(diagnostic.httpStatus, 200);
  assert.equal(diagnostic.contentType, "application/xml");
  assert.equal(diagnostic.responseFormat, "xml");
  assert.equal(diagnostic.documentFormat, "certificate_xml");
  assert.equal(diagnostic.xmlRootElementName, "Certificate");
  assert.equal(diagnostic.expectedDocumentTypeMatched, false);
  assert.equal(diagnostic.documentTypeAttributePresent, true);
  assert.equal(diagnostic.documentTypeAttributeNamespace, null);
  assert.equal(diagnostic.expectedIssuerPresent, true);
  assert.equal(diagnostic.validationFailureReason, "document_type_mismatch");
  assert.equal(diagnostic.signatureBypassActive, true);
  assert.doesNotMatch(JSON.stringify(diagnostics), /999999999999|AquaPay Mock Aadhaar|42 Example Road|01-01-1990|synthetic-code/);
});

test("shared callback logs the exact safe PullDocResponse rejection check", async () => {
  const diagnostics = [];
  const failures = [];
  const attempt = {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    authorizationSessionId: "a".repeat(43),
    verificationType: "aadhaar",
  };
  const wrappedXml = `<PullDocResponse><ResponseStatus status="0"/><DocDetails><DataContent>${Buffer.from(readFixture()).toString("base64")}</DataContent></DocDetails></PullDocResponse>`;
  const provider = {
    async getReference() { return { reference_key: "reference-for-test" }; },
    async getIssuedDocs() {
      return { status: "success", issued_docs: { items: [
        { type: "file", doctype: "ADHAR", issuerid: "in.gov.uidai", uri: "synthetic-uri", mime: ["application/xml"] },
      ] } };
    },
    async getIssuedDocsXml(_body, { onResponseMeta }) {
      onResponseMeta({ httpStatus: 200, contentType: "application/xml", responseFormat: "xml" });
      return wrappedXml;
    },
  };
  const model = {
    async failVerification(context) { failures.push(context); },
    async completeVerification() { assert.fail("invalid wrapper status must not persist"); },
  };
  const shared = createDigilockerService({
    env: SIGNATURE_BYPASS_ENV,
    provider,
    model,
    stateStore: { async consumeAuthorizationState() { return attempt; } },
    logger: { error: (...args) => diagnostics.push(args) },
  });
  createAadhaarService({
    digilocker: shared,
    model,
    validateDocument: (value, options) => validateAadhaarXml(value, {
      ...options,
      env: SIGNATURE_BYPASS_ENV,
    }),
  });

  await assert.rejects(
    shared.completeCallback(
      { code: "synthetic-code", code_verifier: "v".repeat(43), state: "s".repeat(43) },
      { correlationId: "aadhaar-wrapper-test" },
    ),
    { code: "INVALID_VERIFICATION_DOCUMENT" },
  );
  assert.equal(failures.length, 1);
  const diagnostic = diagnostics[0][1];
  assert.equal(diagnostic.correlationId, "aadhaar-wrapper-test");
  assert.equal(diagnostic.stage, "aadhaar_xml_validation");
  assert.equal(diagnostic.providerEndpoint, "get_issued_docs_xml");
  assert.equal(diagnostic.httpStatus, 200);
  assert.equal(diagnostic.documentFormat, "pull_doc_response_xml");
  assert.equal(diagnostic.xmlRootElementName, "PullDocResponse");
  assert.deepEqual(diagnostic.pullDocResponseChecks, {
    responseStatusCount: 1,
    responseStatusSuccess: false,
    docDetailsCount: 1,
    dataContentCount: 1,
    dataContentNonEmpty: true,
  });
  assert.equal(diagnostic.validationFailureReason, "response_status_not_success");
  assert.equal(diagnostic.signatureBypassActive, true);
  assert.doesNotMatch(JSON.stringify(diagnostics), /999999999999|AquaPay Mock Aadhaar|42 Example Road|synthetic-code|<Certificate/);
});

test("Aadhaar verification fails closed when its pinned certificate is missing or expired", () => {
  const oldMode = process.env.IDTO_PROVIDER_MODE;
  const oldPath = process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH;
  process.env.IDTO_PROVIDER_MODE = "idto";
  try {
    delete process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH;
    assert.throws(() => validateAadhaarXml(readFixture()), { code: "SIGNING_CERTIFICATE_NOT_CONFIGURED" });
    process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH = EXPIRED_CERTIFICATE;
    assert.throws(() => validateAadhaarXml(readFixture()), { code: "SIGNING_CERTIFICATE_NOT_CONFIGURED" });
  } finally {
    if (oldMode === undefined) delete process.env.IDTO_PROVIDER_MODE;
    else process.env.IDTO_PROVIDER_MODE = oldMode;
    if (oldPath === undefined) delete process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH;
    else process.env.IDTO_AADHAAR_XML_TRUSTED_CERT_PATH = oldPath;
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

test("Aadhaar Step 2 completes end to end through its service and the shared mock engine", async () => {
  process.env.NODE_ENV = "test";
  process.env.IDTO_PROVIDER_MODE = "mock";
  process.env.IDTO_MOCK_SIGNING_CERT_PATH = CERTIFICATE;
  const env = {
    NODE_ENV: "test",
    IDTO_PROVIDER_MODE: "mock",
    IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000",
  };
  const provider = createDigilockerProvider({ env });
  const redis = new FakeRedis();
  const stateStore = createDigilockerStateStore({ getRedisClient: async () => redis, env });
  const persisted = [];
  const persistedIdentities = [];
  const failures = [];
  const identityModel = {
    async persistVerifiedIdentity(_connection, identity) { persistedIdentities.push(identity); },
  };
  const model = {
    async createPendingVerification(userId, verificationType) {
      return {
        userId: String(userId),
        caseId: "11",
        verificationId: "23",
        authorizationSessionId: "a".repeat(43),
        verificationType,
      };
    },
    async completeVerification(input) {
      persisted.push(input);
      return { stepNumber: 2, steps_completed: 2 };
    },
    async failVerification(input) { failures.push(input); },
  };
  const shared = createDigilockerService({ provider, model, stateStore, env });
  const aadhaar = createAadhaarService({ digilocker: shared, model, identityModel });

  const initiation = await aadhaar.initiateVerification("7", { consent: true });
  assert.equal(initiation.verificationType, "aadhaar");
  assert.equal(initiation.stepNumber, 2);
  const authorizationUrl = new URL(initiation.authorizationUrl);
  assert.equal(authorizationUrl.searchParams.get("document"), "ADHAR");
  const callback = provider.getMockCallbackParameters({
    state: authorizationUrl.searchParams.get("state"),
    document: "ADHAR",
  });
  const completed = await shared.completeCallback(validateCallbackQuery(callback));

  assert.equal(completed.verificationStatus, "verified");
  assert.equal(completed.stepNumber, 2);
  assert.equal(completed.maskedIdentifier, "XXXXXX9999");
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].verificationType, "aadhaar");
  assert.equal(typeof persisted[0].persistIdentity, "function");
  await persisted[0].persistIdentity({}, {
    userId: "7", caseId: "11", verificationId: "23", verificationType: "aadhaar",
    verifiedName: "AquaPay Mock Aadhaar",
  });
  assert.deepEqual(persistedIdentities[0], {
    userId: "7", caseId: "11", verificationId: "23", verificationType: "aadhaar",
    verifiedName: "AquaPay Mock Aadhaar",
    aadhaarNumber: EXPECTED_AADHAAR_FIELDS.aadhaarNumber,
    address: EXPECTED_AADHAAR_FIELDS.address,
    dateOfBirth: EXPECTED_AADHAAR_FIELDS.dateOfBirth,
  });
  assert.equal(Object.hasOwn(completed, "aadhaarNumber"), false);
  assert.equal(Object.hasOwn(completed, "address"), false);
  assert.equal(Object.hasOwn(completed, "dateOfBirth"), false);
  const publicResponse = JSON.stringify(completed);
  assert.equal(publicResponse.includes("999999999999"), false);
  assert.equal(publicResponse.includes("42 Example Road"), false);
  assert.deepEqual(failures, []);
  await assert.rejects(
    shared.completeCallback(validateCallbackQuery(callback)),
    { code: "INVALID_OR_EXPIRED_STATE" },
  );
});

test("Aadhaar service reports validation and transactional persistence stages to shared diagnostics", async () => {
  let handler;
  const stages = [];
  const digilocker = {
    registerVerificationHandler(_type, registered) { handler = registered; return () => {}; },
  };
  const aadhaar = createAadhaarService({
    digilocker,
    model: {
      async completeVerification() { return { stepNumber: 2, steps_completed: 2 }; },
    },
    identityModel: { async persistVerifiedIdentity() {} },
    validateDocument(xml) {
      assert.equal(xml, "<invalid/> ");
      throw new Error("synthetic invalid Aadhaar XML");
    },
  });

  await assert.rejects(handler.verifyAndPersist({
    attempt: { userId: "7", caseId: "11", verificationId: "23", verificationType: "aadhaar" },
    xml: "<invalid/> ",
    setDiagnosticStage: (stage) => stages.push(stage),
  }), /synthetic invalid Aadhaar XML/);
  assert.deepEqual(stages, ["aadhaar_xml_validation"]);

  const persistenceStages = [];
  const successfulAadhaar = createAadhaarService({
    digilocker,
    model: {
      async completeVerification() { return { stepNumber: 2, steps_completed: 2 }; },
    },
    identityModel: { async persistVerifiedIdentity() {} },
    validateDocument: () => ({
      signatureVerified: true,
      developmentOnly: false,
      verificationMode: "issuer_certificate",
      maskedIdentifier: "XXXXXX9999",
      verifiedName: "AquaPay Test Aadhaar",
      aadhaarNumber: "999999999999",
      address: { line1: "Synthetic Road" },
      dateOfBirth: "1990-01-01",
    }),
  });
  const stagesOnly = [];
  await successfulAadhaar.verifyAndPersist({
    attempt: { userId: "7", caseId: "11", verificationId: "23", verificationType: "aadhaar" },
    xml: "<valid/> ",
    setDiagnosticStage: (stage) => stagesOnly.push(stage),
  });
  persistenceStages.push(...stagesOnly);
  assert.deepEqual(persistenceStages, ["aadhaar_xml_validation", "aadhaar_transactional_persistence"]);
});

test("real-IDTO mode returns development_unverified and persists the local-only trust marker", async () => {
  const state = "s".repeat(43);
  const authorizationSessionId = "a".repeat(43);
  const attempt = {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    authorizationSessionId,
    verificationType: "aadhaar",
  };
  const persisted = [];
  const persistedIdentities = [];
  const provider = {
    mode: "idto",
    async initiateSession(body) {
      assert.equal(body.documents_for_consent[0], "ADHAR");
      return { status: "success", code: 1000, url: `https://digilocker.idto.ai/authorize?state=${body.state}` };
    },
    async getReference() {
      return { status: "success", reference_key: "reference_adhar", expires_at: "2099-01-01T00:00:00Z" };
    },
    async getIssuedDocs() {
      return { status: "success", issued_docs: { items: [
        { type: "file", doctype: "ADHAR", issuerid: "in.gov.uidai", uri: "aadhaar.xml", mime: ["application/xml"] },
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
      return { stepNumber: 2, steps_completed: 2 };
    },
    async failVerification() { assert.fail("valid Aadhaar fields should complete in development mode"); },
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
  const aadhaar = createAadhaarService({
    digilocker: shared,
    model,
    identityModel: {
      async persistVerifiedIdentity(_connection, identity) { persistedIdentities.push(identity); },
    },
    validateDocument: (xml) => validateAadhaarXml(xml, { env }),
  });

  await aadhaar.initiateVerification("7", { consent: true });
  const result = await shared.completeCallback({ code: "oauth", code_verifier: "v".repeat(43), state });
  assert.equal(result.verificationStatus, "development_unverified");
  assert.equal(result.signatureVerified, false);
  assert.equal(result.developmentOnly, true);
  assert.equal(persisted[0].signatureVerified, false);
  assert.equal(persisted[0].maskedIdentifier, "XXXXXX9999");
  await persisted[0].persistIdentity({}, {
    ...attempt,
    verifiedName: "AquaPay Mock Aadhaar",
  });
  assert.deepEqual(persistedIdentities[0].address, EXPECTED_AADHAAR_FIELDS.address);
});

test("failed Aadhaar validation never persists identity or changes the canonical profile name", async () => {
  let completeCalls = 0;
  const aadhaar = createAadhaarService({
    digilocker: {
      registerVerificationHandler() { return () => {}; },
      async initiateAuthorization() { return {}; },
    },
    model: {
      async completeVerification() { completeCalls += 1; },
    },
    validateDocument() {
      const error = new Error("invalid document");
      error.code = "INVALID_AADHAAR_DOCUMENT";
      throw error;
    },
  });

  await assert.rejects(aadhaar.verifyAndPersist({ attempt: {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    authorizationSessionId: "a".repeat(43),
    verificationType: "aadhaar",
  }, xml: "<Certificate/>" }), { code: "INVALID_AADHAAR_DOCUMENT" });
  assert.equal(completeCalls, 0);
});

test("Aadhaar identity and canonical profile name persist through the Aadhaar model", async () => {
  const calls = [];
  const aadhaarModel = createAadhaarModel({
    identityModel: {
      async insertIdentityData(connection, input) {
        calls.push(["identity", input]);
      },
    },
  });
  const connection = {
    async execute(sql, values) { calls.push(["sql", sql, values]); },
  };

  await aadhaarModel.persistVerifiedIdentity(connection, {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    verificationType: "aadhaar",
    verifiedName: "Aadhaar Verified Name",
    aadhaarNumber: "999999999999",
    address: EXPECTED_AADHAAR_FIELDS.address,
    dateOfBirth: "1990-01-01",
  });

  assert.deepEqual(calls[0], ["identity", {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    identityType: "aadhaar",
    payload: {
      aadhaarNumber: "999999999999",
      address: EXPECTED_AADHAAR_FIELDS.address,
      dateOfBirth: "1990-01-01",
    },
  }]);
  assert.match(calls[1][1], /UPDATE users\s+SET name = \?/);
  assert.deepEqual(calls[1][2], ["Aadhaar Verified Name", "7"]);
});

test("Aadhaar profile name is untouched when identity persistence fails", async () => {
  const calls = [];
  const aadhaarModel = createAadhaarModel({
    identityModel: {
      async insertIdentityData() { throw new Error("identity persistence failed"); },
    },
  });
  const connection = {
    async execute(sql) { calls.push(sql); },
  };
  await assert.rejects(aadhaarModel.persistVerifiedIdentity(connection, {
    userId: "7",
    caseId: "11",
    verificationId: "23",
    verificationType: "aadhaar",
    verifiedName: "Aadhaar Verified Name",
    aadhaarNumber: "999999999999",
    address: EXPECTED_AADHAAR_FIELDS.address,
    dateOfBirth: "1990-01-01",
  }), /identity persistence failed/);
  assert.equal(calls.some((sql) => /UPDATE users/.test(sql)), false);
});
