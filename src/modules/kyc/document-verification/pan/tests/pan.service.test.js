import test from "node:test";
import assert from "node:assert/strict";
import { createPanService } from "../pan.service.js";
import { createPanDocumentProvider } from "../pan.provider.js";

const validResponse = {
  status: "success",
  error_code: null,
  data: {
    pan_number: "ABCDE1234F",
    full_name: "SHARMA, Rahul Kumar",
    dob: "1900-01-01",
  },
};

function createService({ response = validResponse, providerError, aadhaarError, aadhaarName = "Rahul Kumar Sharma", failPersistenceError, compareNames, providerMode = "idto" } = {}) {
  const calls = { provider: [], create: [], complete: [], fail: [] };
  const service = createPanService({
    aadhaarModel: {
      async getVerifiedAadhaarName(userId) {
        calls.aadhaarUserId = userId;
        if (aadhaarError) throw aadhaarError;
        return aadhaarName;
      },
    },
    provider: {
      mode: providerMode,
      providerName: providerMode === "mock" ? "idto_pan_detailed_v2_mock" : "idto_pan_detailed_v2",
      async verifyPanDetailed(body) {
        calls.provider.push(body);
        if (providerError) throw providerError;
        return typeof response === "function" ? response(body) : response;
      },
    },
    model: {
      async createPendingVerification(userId, options) {
        calls.create.push({ userId, options });
        return { userId: String(userId), caseId: "9", verificationId: "11" };
      },
      async completeVerification(data) {
        calls.complete.push(data);
        return { stepNumber: 3, steps_completed: 3 };
      },
      async failVerification(data) {
        calls.fail.push(data);
        if (failPersistenceError) throw failPersistenceError;
      },
    },
    compareNames: compareNames || undefined,
  });
  return { service, calls };
}

test("PAN service sends only submitted PAN, explicit consent, and trusted Aadhaar name then completes Step 3", async () => {
  const { service, calls } = createService();
  const result = await service.verifyPan(42, { panNumber: "abcde1234f", consent: true });
  assert.equal(calls.aadhaarUserId, 42);
  assert.deepEqual(calls.provider, [{
    pan_number: "ABCDE1234F",
    user_consent: true,
    name: "Rahul Kumar Sharma",
  }]);
  assert.equal(calls.complete.length, 1);
  assert.equal(calls.complete[0].aadhaarVerifiedName, "Rahul Kumar Sharma");
  assert.equal(result.status, "verified");
  assert.equal(result.maskedIdentifier, "XXXXXX234F");
  assert.equal(Object.hasOwn(result, "panNumber"), false);
  assert.equal(calls.fail.length, 0);
});

test("PAN service rejects name mismatch without identity persistence or Step 3 completion", async () => {
  const { service, calls } = createService({
    response: {
      ...validResponse,
      data: { ...validResponse.data, full_name: "Rahul Sharma" },
    },
  });
  await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), (error) => {
    assert.equal(error.code, "PAN_NAME_MISMATCH");
    assert.equal(error.statusCode, 422);
    return true;
  });
  assert.equal(calls.complete.length, 0);
  assert.equal(calls.fail[0].failureCode, "PAN_NAME_MISMATCH");
});

test("PAN service maps IDTO_202 business response separately from provider failure", async () => {
  const { service, calls } = createService({
    response: { status: "success", error_code: "IDTO_202", data: null },
  });
  await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), (error) => {
    assert.equal(error.code, "PAN_NOT_FOUND");
    assert.equal(error.statusCode, 422);
    return true;
  });
  assert.equal(calls.complete.length, 0);
  assert.equal(calls.fail[0].failureCode, "PAN_NOT_FOUND");
});

test("PAN service maps every documented IDTO business code to a safe distinct result", async (t) => {
  const expectations = [
    ["IDTO_001", 400, "PAN_INVALID"],
    ["IDTO_004", 409, "PAN_DUPLICATE_REFERENCE"],
    ["IDTO_005", 400, "PAN_CONSENT_REQUIRED"],
    ["IDTO_006", 429, "PAN_RATE_LIMITED"],
    ["IDTO_007", 503, "PAN_PROVIDER_CONFIGURATION_ERROR"],
    ["IDTO_008", 503, "PAN_PROVIDER_BUSY"],
    ["IDTO_009", 503, "PAN_PROVIDER_UNAVAILABLE"],
  ];
  for (const [providerCode, expectedStatus, expectedCode] of expectations) {
    await t.test(providerCode, async () => {
      const { service, calls } = createService({
        response: { status: "success", error_code: providerCode, data: null },
      });
      await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), (error) => {
        assert.equal(error.statusCode, expectedStatus);
        assert.equal(error.code, expectedCode);
        return true;
      });
      assert.equal(calls.complete.length, 0);
      assert.equal(calls.fail[0].failureCode, expectedCode);
    });
  }
});

test("PAN service maps provider rate limits and timeouts without treating them as name mismatches", async (t) => {
  await t.test("rate limit", async () => {
    const { service, calls } = createService({
      providerError: { code: "IDTO_HTTP_ERROR", responseMetadata: { providerErrorCode: "IDTO_006" } },
    });
    await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), (error) => {
      assert.equal(error.code, "PAN_RATE_LIMITED");
      assert.equal(error.statusCode, 429);
      return true;
    });
    assert.equal(calls.fail[0].failureCode, "PAN_RATE_LIMITED");
    assert.equal(calls.complete.length, 0);
  });
  await t.test("timeout", async () => {
    const { service, calls } = createService({ providerError: { code: "IDTO_TIMEOUT" } });
    await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), (error) => {
      assert.equal(error.code, "PAN_PROVIDER_TIMEOUT");
      assert.equal(error.statusCode, 503);
      return true;
    });
    assert.equal(calls.fail[0].failureCode, "PAN_PROVIDER_TIMEOUT");
  });
});

test("PAN service requires the internally verified Aadhaar name and rejects client-supplied identity", async () => {
  const missing = createService({ aadhaarError: new Error("AADHAAR_VERIFICATION_NOT_COMPLETED") });
  await assert.rejects(missing.service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), {
    code: "AADHAAR_PREREQUISITE_NOT_COMPLETED",
  });
  assert.equal(missing.calls.create.length, 0);
  assert.equal(missing.calls.provider.length, 0);

  const normal = createService();
  await assert.rejects(normal.service.verifyPan(42, {
    panNumber: "ABCDE1234F", consent: true, name: "client supplied",
  }), { code: "VALIDATION_ERROR" });
  assert.equal(normal.calls.provider.length, 0);
});

test("PAN service rejects invalid trusted Aadhaar names before provider or attempt creation", async (t) => {
  for (const aadhaarName of ["", "   ", "Aadhaar\nName", "A".repeat(101)]) {
    await t.test(JSON.stringify(aadhaarName), async () => {
      const { service, calls } = createService({ aadhaarName });
      await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), {
        code: "AADHAAR_VERIFIED_NAME_UNAVAILABLE",
      });
      assert.equal(calls.create.length, 0);
      assert.equal(calls.provider.length, 0);
      assert.equal(calls.complete.length, 0);
    });
  }
});

test("PAN service distinguishes malformed response and does not complete KYC", async () => {
  const { service, calls } = createService({ response: { status: "success", error_code: null, data: null } });
  await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), {
    code: "PAN_PROVIDER_INVALID_RESPONSE",
  });
  assert.equal(calls.complete.length, 0);
});

test("PAN service rejects a missing PAN holder name before completion", async () => {
  const { service, calls } = createService({
    response: { ...validResponse, data: { pan_number: "ABCDE1234F" } },
  });
  await assert.rejects(service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true }), {
    code: "PAN_PROVIDER_INVALID_RESPONSE",
  });
  assert.equal(calls.complete.length, 0);
});

test("PAN service marks mock completion explicitly as development-unverified", async () => {
  const { service, calls } = createService({ providerMode: "mock" });
  const result = await service.verifyPan(42, { panNumber: "ABCDE1234F", consent: true });
  assert.equal(result.status, "development_unverified");
  assert.equal(result.developmentOnly, true);
  assert.equal(calls.complete[0].providerName, "idto_pan_detailed_v2_mock");
  assert.equal(result.maskedIdentifier, "XXXXXX234F");
});

test("PAN service never logs or returns the raw PAN when provider and failure persistence fail", async () => {
  const rawPan = "ABCDE1234F";
  const { service, calls } = createService({
    providerError: new Error(`sensitive provider detail ${rawPan}`),
    failPersistenceError: new Error(`database detail ${rawPan}`),
  });
  const originalError = console.error;
  const logOutput = [];
  console.error = (...values) => logOutput.push(values.join(" "));
  try {
    await assert.rejects(service.verifyPan(42, { panNumber: rawPan, consent: true }), (error) => {
      assert.notEqual(error.message.includes(rawPan), true);
      return true;
    });
  } finally {
    console.error = originalError;
  }
  assert.equal(JSON.stringify(logOutput).includes(rawPan), false);
  assert.equal(JSON.stringify(calls.fail).includes(rawPan), false);
  assert.equal(calls.complete.length, 0);
});

test("PAN development mock provider never invokes the network client", async () => {
  const provider = createPanDocumentProvider({
    env: { NODE_ENV: "development", IDTO_PROVIDER_MODE: "mock" },
    fetchImpl: async () => { throw new Error("network must not be used"); },
  });
  assert.equal(provider.mode, "mock");
  const result = await provider.verifyPanDetailed({
    pan_number: "ABCDE1234F", user_consent: true, name: "Synthetic Person",
  });
  assert.equal(result.error_code, null);
});
