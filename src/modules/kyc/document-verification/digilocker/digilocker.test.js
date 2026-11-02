import assert from "node:assert/strict";
import { test, after } from "node:test";

import "../../../auth/setupEnv.js";

import { createDigilockerService } from "./digilocker.service.js";
import digilockerModel from "./digilocker.model.js";
import digilockerStateStore from "./digilockerStateStore.js";

// Simple inline mock provider so tests are not affected by
// createDigilockerMockProvider's environment validation.
function createInlineMockProvider() {
  const MOCK_CODE_VERIFIER = "m".repeat(43);
  return {
    mode: "mock",
    initiateSession: async (body) => {
      if (
        body?.consent !== true ||
        body?.redirect_to_signup !== false ||
        !Array.isArray(body?.documents_for_consent) ||
        body.documents_for_consent.length !== 1 ||
        typeof body.state !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(body.state)
      ) {
        throw new Error("Invalid mock DigiLocker initiation request");
      }
      const url = new URL(
        "/api/kyc/digilocker/mock-authorize",
        "http://127.0.0.1:3000"
      );
      url.searchParams.set("state", body.state);
      url.searchParams.set("document", body.documents_for_consent[0]);
      return { status: "success", code: 1000, url: url.toString() };
    },
    getReference: async ({ code, code_verifier } = {}) => {
      if (code_verifier !== MOCK_CODE_VERIFIER) {
        throw new Error("Invalid mock code verifier");
      }
      const docMap = {
        "aquapay-mock-adhar-v1": {
          reference_key: "aquapay_mock_reference_adhar_v1",
          expires_at: "2099-01-01T00:00:00.000Z",
        },
        "aquapay-mock-pancr-v1": {
          reference_key: "aquapay_mock_reference_pancr_v1",
          expires_at: "2099-01-01T00:00:00.000Z",
        },
      };
      const doc = docMap[code];
      if (!doc) throw new Error("Invalid mock reference key");
      return { status: "success", ...doc };
    },
    getIssuedDocs: async ({ reference_key } = {}) => {
      const docs = {
        aquapay_mock_reference_adhar_v1: {
          status: "success",
          issued_docs: {
            items: [{
              name: "Aadhaar Card",
              type: "file",
              size: "",
              date: "2025-01-01T00:00:00Z",
              parent: "",
              mime: ["application/xml"],
              uri: "in.gov.uidai-ADHAR-aquapay-mock-v1",
              doctype: "ADHAR",
              issuerid: "in.gov.uidai",
              issuer: "Unique Identification Authority of India",
            }],
          },
        },
        aquapay_mock_reference_pancr_v1: {
          status: "success",
          issued_docs: {
            items: [{
              name: "PAN Card",
              type: "file",
              size: "",
              date: "2025-01-01T00:00:00Z",
              parent: "",
              mime: ["application/xml"],
              uri: "in.gov.pan-PANCR-aquapay-mock-v1",
              doctype: "PANCR",
              issuerid: "in.gov.pan",
              issuer: "Income Tax Department",
            }],
          },
        },
      };
      const doc = docs[reference_key];
      if (!doc) throw new Error("Invalid mock reference key");
      return doc;
    },
    getIssuedDocsXml: async ({ reference_key, uri } = {}) => {
      const expectedUriMap = {
        aquapay_mock_reference_adhar_v1: "in.gov.uidai-ADHAR-aquapay-mock-v1",
        aquapay_mock_reference_pancr_v1: "in.gov.pan-PANCR-aquapay-mock-v1",
      };
      if (!reference_key || uri !== expectedUriMap[reference_key]) {
        throw new Error("Invalid mock document request");
      }
      return `<?xml version="1.0"?>
<Certificate type="${reference_key.includes('adhar') ? 'ADHAR' : 'PANCR'}">
  <IssuedTo>
    <Person uid="999999999999" name="Test User" dob="01-01-1990" />
  </IssuedTo>
  <IssuedBy>
    <Organization name="${reference_key.includes('adhar') ? 'Unique Identification Authority of India' : 'Income Tax Department'}" />
  </IssuedBy>
</Certificate>`;
    },
  };
}

const originalCreatePendingVerification = digilockerModel.createPendingVerification;
const originalCompleteVerification = digilockerModel.completeVerification;
const originalFailVerification = digilockerModel.failVerification;
const originalCreateAuthorizationState = digilockerStateStore.createAuthorizationState;
const originalConsumeAuthorizationState = digilockerStateStore.consumeAuthorizationState;
const originalDiscardAuthorizationState = digilockerStateStore.discardAuthorizationState;

after(() => {
  digilockerModel.createPendingVerification = originalCreatePendingVerification;
  digilockerModel.completeVerification = originalCompleteVerification;
  digilockerModel.failVerification = originalFailVerification;
  digilockerStateStore.createAuthorizationState = originalCreateAuthorizationState;
  digilockerStateStore.consumeAuthorizationState = originalConsumeAuthorizationState;
  digilockerStateStore.discardAuthorizationState = originalDiscardAuthorizationState;
});

function mockModel({
  pendingResult = {
    userId: "52",
    caseId: "13",
    verificationId: "31",
    authorizationSessionId: "abc123def456ghi789jkl012mno345pqr678stu901",
    verificationType: "aadhaar",
    stepNumber: 2,
  },
  completeResult = {
    verificationType: "aadhaar",
    stepNumber: 2,
    steps_completed: 2,
  },
  shouldFail = false,
} = {}) {
  const counters = { pendingCalls: 0, completeCalls: 0 };

  digilockerModel.createPendingVerification = async (userId, verificationType) => {
    counters.pendingCalls += 1;
    if (shouldFail) throw new Error("KYC_PREREQUISITE_NOT_COMPLETED");
    return pendingResult;
  };

  digilockerModel.completeVerification = async (attempt) => {
    counters.completeCalls += 1;
    return completeResult;
  };

  digilockerModel.failVerification = async () => {};

  return counters;
}

function mockStateStore({
  state = "abc123def456ghi789jkl012mno345pqr678stu901",
  expiresIn = 600,
  consumeResult = null,
} = {}) {
  const counters = { createCalls: 0, consumeCalls: 0, discardCalls: 0 };

  digilockerStateStore.createAuthorizationState = async (context) => {
    counters.createCalls += 1;
    return { state, expiresIn };
  };

  digilockerStateStore.consumeAuthorizationState = async (s) => {
    counters.consumeCalls += 1;
    return consumeResult;
  };

  digilockerStateStore.discardAuthorizationState = async () => {
    counters.discardCalls += 1;
    return true;
  };

  return counters;
}

function registerTestHandlers(service, type = "aadhaar") {
  const handler = {
    documentCode: type === "aadhaar" ? "ADHAR" : "PANCR",
    issuerId: type === "aadhaar" ? "in.gov.uidai" : "in.gov.pan",
    consentPurpose: `Test ${type} verification`,
    stepNumber: type === "aadhaar" ? 2 : 3,
    async verifyAndPersist() {
      return {
        extracted: {
          maskedIdentifier: `XXXXXX${type === "aadhaar" ? "1234" : "5678"}`,
          verifiedName: "Test User",
          signatureVerified: false,
          developmentOnly: true,
          verificationMode: "development_unverified",
        },
        completion: {
          stepNumber: type === "aadhaar" ? 2 : 3,
          steps_completed: type === "aadhaar" ? 2 : 3,
        },
      };
    },
  };
  service.registerVerificationHandler(type, handler);
  return () => service.registerVerificationHandler(type, null) || service;
}

test("initiateAuthorization rejects when consent is not true", async () => {
  mockModel();
  mockStateStore();

  const provider = createInlineMockProvider();
  const service = createDigilockerService({
    provider,
    env: { NODE_ENV: "development", IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000", PORT: "3000" },
  });
  registerTestHandlers(service, "aadhaar");

  try {
    await assert.rejects(
      service.initiateAuthorization("52", "aadhaar", { consent: false }),
      (error) => error.statusCode === 400 && error.code === "CONSENT_REQUIRED"
    );
  } finally {
    service.unregister?.();
  }
});

test("initiateAuthorization creates pending verification and authorization state", async () => {
  const counters = mockModel();
  const stateStore = {
    createAuthorizationState: async () => ({ state: "abc123def456ghi789jkl012mno345pqr678stu901", expiresIn: 600 }),
    consumeAuthorizationState: async () => null,
    discardAuthorizationState: async () => true,
  };
  let createCalls = 0;
  const originalCreate = stateStore.createAuthorizationState;
  stateStore.createAuthorizationState = async (ctx) => {
    createCalls += 1;
    return originalCreate(ctx);
  };

  const provider = createInlineMockProvider();
  const service = createDigilockerService({
    provider,
    stateStore,
    env: { NODE_ENV: "development", IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000", PORT: "3000" },
  });
  registerTestHandlers(service, "aadhaar");

  try {
    const result = await service.initiateAuthorization("52", "aadhaar", { consent: true });

    assert.equal(counters.pendingCalls, 1);
    assert.equal(createCalls, 1);
    assert.equal(result.verificationType, "aadhaar");
    assert.equal(result.stepNumber, 2);
    assert.ok(result.authorizationUrl);
    assert.ok(result.expiresIn);
  } finally {
    service.unregister?.();
  }
});

test("initiateAuthorization rejects when prerequisite step not completed", async () => {
  mockModel({ shouldFail: true });
  mockStateStore();

  const provider = createInlineMockProvider();
  const service = createDigilockerService({
    provider,
    env: { NODE_ENV: "development", IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000", PORT: "3000" },
  });
  registerTestHandlers(service, "pan");

  try {
    await assert.rejects(
      service.initiateAuthorization("52", "pan", { consent: true }),
      (error) => error.statusCode === 409 && error.code === "KYC_PREREQUISITE_NOT_COMPLETED"
    );
  } finally {
    service.unregister?.();
  }
});

test("completeCallback consumes state only once (single-use)", async () => {
  const consumeResult = {
    userId: "52",
    caseId: "13",
    verificationId: "31",
    authorizationSessionId: "abc123def456ghi789jkl012mno345pqr678stu901",
    verificationType: "aadhaar",
  };
  const consumeResultRef = { consumeResult };
  const stateStore = {
    createAuthorizationState: async () => ({ state: "abc123def456ghi789jkl012mno345pqr678stu901", expiresIn: 600 }),
    consumeAuthorizationState: async (s) => {
      consumeResultRef.calls = (consumeResultRef.calls || 0) + 1;
      return consumeResultRef.consumeResult;
    },
    discardAuthorizationState: async () => true,
  };
  mockModel();

  const provider = createInlineMockProvider();
  const service = createDigilockerService({
    provider,
    stateStore,
    env: { NODE_ENV: "development", IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000", PORT: "3000" },
  });
  registerTestHandlers(service, "aadhaar");

  try {
    const result = await service.completeCallback(
      {
        code: "aquapay-mock-adhar-v1",
        code_verifier: "m".repeat(43),
        state: "abc123def456ghi789jkl012mno345pqr678stu901",
      },
      { correlationId: "test-correlation" }
    );

    assert.equal(consumeResultRef.calls, 1);
    assert.equal(result.verificationType, "aadhaar");
    assert.equal(result.stepNumber, 2);
    assert.equal(result.verificationStatus, "development_unverified");
    assert.equal(result.signatureVerified, false);
    assert.equal(result.developmentOnly, true);
    assert.equal(result.verificationMode, "development_unverified");
    assert.ok(result.maskedIdentifier);
    assert.ok(result.verifiedName);
  } catch (e) {
    console.error("DEBUG completeCallback error:", e.message, e.code, "calls:", consumeResultRef.calls);
    throw e;
  } finally {
    service.unregister?.();
  }
});

test("completeCallback rejects with invalid or expired state on second use", async () => {
  digilockerStateStore.consumeAuthorizationState = async () => {
    return null;
  };

  const provider = createInlineMockProvider();
  const service = createDigilockerService({
    provider,
    env: { NODE_ENV: "development", IDTO_MOCK_BASE_URL: "http://127.0.0.1:3000", PORT: "3000" },
  });
  registerTestHandlers(service, "aadhaar");

  try {
    await assert.rejects(
      service.completeCallback(
        {
          code: "aquapay-mock-adhar-v1",
          code_verifier: "m".repeat(43),
          state: "used-state",
        },
        { correlationId: "test-correlation" }
      ),
      (error) => error.statusCode === 400 && error.code === "INVALID_OR_EXPIRED_STATE"
    );
  } finally {
    service.unregister?.();
  }
});
