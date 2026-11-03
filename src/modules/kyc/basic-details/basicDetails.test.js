import assert from "node:assert/strict";
import crypto from "node:crypto";
import { after, test } from "node:test";

import "../../auth/setupEnv.js";

import app from "../../../app.js";
import redisConnection from "../../../config/redis.js";
import { errorHandler } from "../../../middlewares/error.middleware.js";
import ApiError from "../../../utils/ApiError.js";
import basicDetailsController from "./basicDetails.controller.js";
import basicDetailsModel from "./basicDetails.model.js";
import basicDetailsService from "./basicDetails.service.js";
import kycOtpStore from "./kycOtpStore.js";
import {
  validateBasicDetails,
  validateKycOtpRequest,
  validateKycOtp,
} from "./basicDetails.validator.js";

const originalKycOtpSecret = process.env.KYC_OTP_SECRET;
process.env.KYC_OTP_SECRET = "unit-test-kyc-otp-secret-with-at-least-32-bytes";
after(() => {
  if (originalKycOtpSecret === undefined) delete process.env.KYC_OTP_SECRET;
  else process.env.KYC_OTP_SECRET = originalKycOtpSecret;
});

const validBody = {
  businessType: "Retail Store",
  shopAddress: "12 Market Road",
  city: "Pune",
  pincode: "411001",
};

function runValidator(body) {
  const req = { body };
  let error;
  validateBasicDetails(req, {}, (nextError) => {
    error = nextError;
  });
  return { req, error };
}

function replaceModelMethods(overrides) {
  const originals = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, basicDetailsModel[name]]),
  );
  Object.assign(basicDetailsModel, overrides);
  return () => Object.assign(basicDetailsModel, originals);
}

function replaceStoreMethods(overrides) {
  const originals = Object.fromEntries(
    Object.keys(overrides).map((name) => [name, kycOtpStore[name]]),
  );
  Object.assign(kycOtpStore, overrides);
  return () => Object.assign(kycOtpStore, originals);
}

function createConnection() {
  const calls = [];
  return {
    calls,
    beginTransaction: async () => calls.push("begin"),
    commit: async () => calls.push("commit"),
    rollback: async () => calls.push("rollback"),
    release: () => calls.push("release"),
  };
}

function setupOtpContext({
  userId = "52",
  caseId = 13,
  caseStatus = "pending",
  stepStatus = "in_progress",
  cases,
  userOverrides = {},
  completeError,
} = {}) {
  const connections = [];
  const state = {
    stepStatus,
    completedAt: null,
    stepsCompleted: 2,
    completedCalls: 0,
  };
  const restore = replaceModelMethods({
    getConnection: async () => {
      const connection = createConnection();
      connections.push(connection);
      return connection;
    },
    findActiveUserForUpdate: async (_connection, requestedUserId) => ({
      id: requestedUserId,
      address: "12 Market Road",
      city: "Pune",
      pincode: "411001",
      status: "active",
      ...userOverrides,
    }),
    findCasesByUserIdForUpdate: async () => cases || [{
      id: caseId,
      user_id: userId,
      business_type: "Retail Store",
      status: caseStatus,
      steps_completed: 2,
    }],
    findStepByCaseIdAndNumber: async () => ({
      step_number: 1,
      status: state.stepStatus,
      completed_at: state.completedAt,
    }),
    completeStep1: async () => {
      if (completeError) throw completeError;
      if (state.stepStatus === "completed") return false;
      state.stepStatus = "completed";
      state.completedAt = new Date();
      state.completedCalls += 1;
      return true;
    },
    updateCompletedStepsCount: async () => {
      state.stepsCompleted = 3;
      return state.stepsCompleted;
    },
    findStepCompletionState: async () => ({
      status: state.stepStatus,
      completed_at: state.completedAt,
      steps_completed: state.stepsCompleted,
    }),
  });
  return { connections, state, restore };
}

function createFakeOtpStore() {
  const state = {
    challenge: null,
    cooldownUntil: 0,
    requestCount: 0,
    verificationCount: 0,
  };
  const sameContext = (challenge, values) => challenge &&
    String(challenge.userId) === String(values.userId) &&
    String(challenge.caseId) === String(values.caseId) &&
    String(challenge.stepNumber) === String(values.stepNumber);

  const restore = replaceStoreMethods({
    issueChallenge: async (values) => {
      if (state.cooldownUntil > Date.now()) {
        return { status: "cooldown", retryAfter: 60 };
      }
      if (state.requestCount >= 5) return { status: "rate_limited", retryAfter: 900 };
      state.requestCount += 1;
      state.challenge = {
        ...values,
        attempts: 0,
        status: "active",
        expiresAt: Date.now() + 300000,
      };
      state.cooldownUntil = Date.now() + 60000;
      return { status: "issued" };
    },
    claimChallenge: async (values) => {
      state.verificationCount += 1;
      if (state.verificationCount > 10) return { status: "rate_limited", retryAfter: 900 };
      const challenge = state.challenge;
      if (!sameContext(challenge, values) || challenge.expiresAt <= Date.now()) {
        return { status: "invalid" };
      }
      if (challenge.detailsFingerprint !== values.detailsFingerprint) {
        challenge.status = "superseded";
        return { status: "invalid" };
      }
      if (challenge.status === "verifying" && challenge.leaseUntil > Date.now()) {
        return { status: "invalid" };
      }
      if (challenge.status === "verifying") challenge.status = "active";
      if (challenge.status !== "active" || challenge.attempts >= 5) {
        challenge.status = "locked";
        return { status: "invalid" };
      }
      challenge.attempts += 1;
      challenge.status = "verifying";
      challenge.claimId = values.claimId;
      challenge.leaseUntil = Date.now() + 30000;
      return { status: "claimed", otpHash: challenge.otpHash };
    },
    rejectClaim: async (values) => {
      const challenge = state.challenge;
      if (!sameContext(challenge, values) || challenge.claimId !== values.claimId) return false;
      challenge.status = challenge.attempts >= 5 ? "locked" : "active";
      challenge.claimId = null;
      challenge.leaseUntil = 0;
      return true;
    },
    releaseClaim: async (values) => {
      const challenge = state.challenge;
      if (!sameContext(challenge, values) || challenge.claimId !== values.claimId) return false;
      challenge.attempts = Math.max(0, challenge.attempts - 1);
      challenge.status = "active";
      challenge.claimId = null;
      challenge.leaseUntil = 0;
      return true;
    },
    consumeClaim: async (values) => {
      const challenge = state.challenge;
      if (!sameContext(challenge, values) || challenge.claimId !== values.claimId) return false;
      challenge.status = "consumed";
      challenge.otpHash = null;
      challenge.claimId = null;
      challenge.leaseUntil = 0;
      return true;
    },
    discardChallenge: async ({ caseId, challengeId }) => {
      if (
        state.challenge &&
        String(state.challenge.caseId) === String(caseId) &&
        state.challenge.challengeId === challengeId
      ) {
        state.challenge = null;
        return true;
      }
      return false;
    },
    invalidateChallenge: async (values) => {
      if (sameContext(state.challenge, values)) {
        state.challenge = null;
        return true;
      }
      return false;
    },
  });
  return { state, restore };
}

function mockExistingCase(connection, overrides = {}) {
  const modelCalls = [];
  let step1Status = overrides.stepStatus || "pending";
  const restore = replaceModelMethods({
    getConnection: async () => connection,
    findActiveUserForUpdate: async (_connection, userId) => {
      modelCalls.push(["findUser", userId]);
      return { id: userId, status: "active" };
    },
    findCasesByUserIdForUpdate: async (_connection, userId) => {
      modelCalls.push(["findCases", userId]);
      return [{ id: 13, user_id: userId, status: "pending", ...overrides.kycCase }];
    },
    findStepByCaseIdAndNumber: async (_connection, caseId, stepNumber) => {
      modelCalls.push(["findStep", caseId, stepNumber]);
      return overrides.step === null
        ? null
        : { step_number: 1, status: step1Status };
    },
    resetStep1ToInProgress: async (_connection, caseId) => {
      modelCalls.push(["resetStep1", caseId]);
      step1Status = "in_progress";
      return true;
    },
    updateCaseBasicDetails: async (_connection, caseId, businessType) => {
      modelCalls.push(["updateCase", caseId, businessType]);
      return true;
    },
    updateUserAddress: async (_connection, userId, fields) => {
      modelCalls.push(["updateUser", userId, fields]);
      return true;
    },
    countCompletedSteps: async (_connection, caseId) => {
      modelCalls.push(["countCompleted", caseId]);
      return 0;
    },
    ...overrides.model,
  });
  return { modelCalls, restore, getStep1Status: () => step1Status };
}

test("basic-details validator normalizes supported fields and rejects unknown fields", () => {
  const { req, error } = runValidator({
    businessType: "  Retail Store  ",
    shopAddress: "  12 Market Road  ",
    city: "  Pune  ",
    pincode: " 411001 ",
  });

  assert.equal(error, undefined);
  assert.deepEqual(req.validatedBody, validBody);

  const invalid = runValidator({ ...validBody, userId: 99 });
  assert.equal(invalid.error.statusCode, 400);
  assert.equal(invalid.error.code, "VALIDATION_ERROR");

  const invalidPincode = runValidator({ ...validBody, pincode: "011001" });
  assert.equal(invalidPincode.error.code, "VALIDATION_ERROR");
});

test("KYC OTP validators accept an empty request body and exactly six numeric digits", () => {
  const request = { body: {} };
  let requestError;
  validateKycOtpRequest(request, {}, (error) => { requestError = error; });
  assert.equal(requestError, undefined);

  const unexpectedRequest = { body: { userId: 52 } };
  validateKycOtpRequest(unexpectedRequest, {}, (error) => { requestError = error; });
  assert.equal(requestError.code, "VALIDATION_ERROR");

  const validOtp = { body: { otp: "001234" } };
  let otpError;
  validateKycOtp(validOtp, {}, (error) => { otpError = error; });
  assert.equal(otpError, undefined);
  assert.equal(validOtp.validatedOtp, "001234");

  for (const body of [{ otp: "12345" }, { otp: "12345x" }, { otp: "123456", userId: 52 }]) {
    validateKycOtp({ body }, {}, (error) => { otpError = error; });
    assert.equal(otpError.code, "VALIDATION_ERROR");
  }
});

test("KYC OTP request stores a bound hash and prints only the OTP in development", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  const terminal = [];
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = (message) => terminal.push(message);

  try {
    const result = await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    const fingerprint = crypto
      .createHmac("sha256", process.env.KYC_OTP_SECRET)
      .update(`aquapay:kyc:step1:details:${JSON.stringify([
        "52",
        "13",
        1,
        "Retail Store",
        "12 Market Road",
        "Pune",
        "411001",
      ])}`)
      .digest("hex");
    const expectedOtpHash = crypto
      .createHmac("sha256", process.env.KYC_OTP_SECRET)
      .update(`aquapay:kyc:step1:otp:${JSON.stringify([
        "52",
        "13",
        1,
        fingerprint,
        "123456",
      ])}`)
      .digest("hex");

    assert.deepEqual(result, { message: "OTP requested successfully" });
    assert.equal(store.state.challenge.otpHash, expectedOtpHash);
    assert.equal(store.state.challenge.detailsFingerprint, fingerprint);
    assert.equal(store.state.challenge.userId, "52");
    assert.equal(store.state.challenge.caseId, 13);
    assert.equal(store.state.challenge.stepNumber, 1);
    assert.match(terminal[0], /^\[AquaPay KYC DEVELOPMENT OTP\] 123456$/);
    assert.equal(JSON.stringify(result).includes("123456"), false);
    assert.equal(JSON.stringify(result).includes(expectedOtpHash), false);
    assert.deepEqual(scenario.connections[0].calls, ["begin", "commit", "release"]);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP request fails closed outside development without logging or returning an OTP", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  const terminal = [];
  process.env.NODE_ENV = "production";
  crypto.randomInt = () => 654321;
  console.info = (...args) => terminal.push(args);

  try {
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.statusCode === 503 && error.code === "SERVICE_UNAVAILABLE",
    );
    assert.deepEqual(terminal, []);
    assert.equal(store.state.challenge, null);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP request requires one saved case and valid saved details", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const scenario = setupOtpContext({ cases: [] });
  let issued = false;
  const storeRestore = replaceStoreMethods({
    issueChallenge: async () => { issued = true; return { status: "issued" }; },
  });
  try {
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.code === "KYC_CASE_NOT_FOUND",
    );
    assert.equal(issued, false);
    assert.deepEqual(scenario.connections[0].calls, ["begin", "rollback", "release"]);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    scenario.restore();
    storeRestore();
  }

  const ambiguousCases = setupOtpContext({
    cases: [
      { id: 13, user_id: "52", business_type: "Retail Store", status: "pending" },
      { id: 14, user_id: "52", business_type: "Retail Store", status: "pending" },
    ],
  });
  const ambiguousStore = replaceStoreMethods({
    issueChallenge: async () => { issued = true; return { status: "issued" }; },
  });
  try {
    issued = false;
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.code === "KYC_CASE_AMBIGUOUS",
    );
    assert.equal(issued, false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    ambiguousCases.restore();
    ambiguousStore();
  }

  const missingDetails = setupOtpContext({ userOverrides: { address: "" } });
  process.env.NODE_ENV = "development";
  const missingStore = replaceStoreMethods({
    issueChallenge: async () => { issued = true; return { status: "issued" }; },
  });
  try {
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.code === "BASIC_DETAILS_REQUIRED",
    );
    assert.equal(issued, false);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    missingDetails.restore();
    missingStore();
  }
});

test("KYC OTP request enforces cooldown and a new request supersedes the prior OTP", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  const terminal = [];
  const otpSequence = [123456, 999999, 654321];
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => otpSequence.shift();
  console.info = (message) => terminal.push(message);

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    const firstChallengeId = store.state.challenge.challengeId;
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.statusCode === 429 && error.code === "RATE_LIMITED",
    );
    store.state.cooldownUntil = 0;
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    assert.notEqual(store.state.challenge.challengeId, firstChallengeId);
    assert.match(terminal[0], /123456$/);
    assert.match(terminal[1], /654321$/);

    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.code === "INVALID_OR_EXPIRED_OTP",
    );
    const result = await basicDetailsService.verifyStep1Otp("52", "654321", "203.0.113.10");
    assert.equal(result.steps_completed, 3);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP verification completes Step 1 once and recalculates completed progress", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = () => {};

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    const result = await basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10");
    assert.equal(result.message, "Step 1 verified successfully");
    assert.equal(result.steps_completed, 3);
    assert.equal(scenario.state.stepStatus, "completed");
    assert.ok(scenario.state.completedAt instanceof Date);
    assert.equal(scenario.state.completedCalls, 1);
    assert.equal(store.state.challenge.status, "consumed");
    assert.equal(store.state.challenge.otpHash, null);
    assert.deepEqual(scenario.connections.at(-1).calls, ["begin", "commit", "release"]);

    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.code === "STEP_ALREADY_COMPLETED",
    );
    assert.equal(scenario.state.completedCalls, 1);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP verification rejects incorrect and expired codes without completing Step 1", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = () => {};

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await assert.rejects(
        basicDetailsService.verifyStep1Otp("52", "000000", "203.0.113.10"),
        (error) => error.code === "INVALID_OR_EXPIRED_OTP",
      );
    }
    assert.equal(store.state.challenge.attempts, 5);
    assert.equal(store.state.challenge.status, "locked");
    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.code === "INVALID_OR_EXPIRED_OTP",
    );
    assert.equal(scenario.state.stepStatus, "in_progress");
    assert.equal(scenario.state.completedCalls, 0);

    store.state.challenge.status = "active";
    store.state.challenge.attempts = 0;
    store.state.challenge.expiresAt = Date.now() - 1;
    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.code === "INVALID_OR_EXPIRED_OTP",
    );
    assert.equal(scenario.state.stepStatus, "in_progress");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP challenge is scoped to the authenticated user's KYC case", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = () => {};

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    store.state.challenge.userId = "99";
    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.code === "INVALID_OR_EXPIRED_OTP",
    );
    assert.equal(scenario.state.stepStatus, "in_progress");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("KYC OTP Redis failure returns 503 and does not change KYC progress", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "development";
  const scenario = setupOtpContext();
  const storeRestore = replaceStoreMethods({
    issueChallenge: async () => { throw new Error("Redis unavailable"); },
  });
  try {
    await assert.rejects(
      basicDetailsService.requestStep1Otp("52", "203.0.113.10"),
      (error) => error.statusCode === 503 && error.code === "SERVICE_UNAVAILABLE",
    );
    assert.equal(scenario.state.stepStatus, "in_progress");
    assert.deepEqual(scenario.connections[0].calls, ["begin", "rollback", "release"]);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    scenario.restore();
    storeRestore();
  }
});

test("KYC MySQL failure releases the Redis verification claim for safe retry", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext({ completeError: new Error("SQL failure") });
  const store = createFakeOtpStore();
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = () => {};

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    await assert.rejects(
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      (error) => error.statusCode === 503 && error.code === "SERVICE_UNAVAILABLE",
    );
    assert.equal(scenario.state.stepStatus, "in_progress");
    assert.equal(store.state.challenge.status, "active");
    assert.equal(store.state.challenge.attempts, 0);
    assert.deepEqual(scenario.connections.at(-1).calls, ["begin", "rollback", "release"]);
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("concurrent KYC OTP verification requests complete Step 1 only once", async () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const originalRandomInt = crypto.randomInt;
  const originalInfo = console.info;
  const scenario = setupOtpContext();
  const store = createFakeOtpStore();
  process.env.NODE_ENV = "development";
  crypto.randomInt = () => 123456;
  console.info = () => {};

  try {
    await basicDetailsService.requestStep1Otp("52", "203.0.113.10");
    const attempts = await Promise.allSettled([
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
      basicDetailsService.verifyStep1Otp("52", "123456", "203.0.113.10"),
    ]);
    assert.equal(attempts.filter((attempt) => attempt.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((attempt) => attempt.status === "rejected").length, 1);
    assert.equal(scenario.state.completedCalls, 1);
    assert.equal(scenario.state.stepStatus, "completed");
  } finally {
    process.env.NODE_ENV = previousNodeEnv;
    crypto.randomInt = originalRandomInt;
    console.info = originalInfo;
    scenario.restore();
    store.restore();
  }
});

test("updating saved Basic Details invalidates any existing Step 1 OTP", async () => {
  const connection = createConnection();
  const { modelCalls, restore } = mockExistingCase(connection, { stepStatus: "in_progress" });
  const invalidations = [];
  const storeRestore = replaceStoreMethods({
    invalidateChallenge: async (challenge) => { invalidations.push(challenge); return true; },
  });
  try {
    await basicDetailsService.saveBasicDetails("52", validBody);
    assert.deepEqual(invalidations, [{ userId: "52", caseId: 13, stepNumber: 1 }]);
    assert.equal(modelCalls.findIndex(([name]) => name === "resetStep1") > -1, true);
  } finally {
    restore();
    storeRestore();
  }
});

test("Redis scripts perform challenge lifecycle operations atomically through EVAL", async () => {
  const originalGetRedisClient = redisConnection.getRedisClient;
  const calls = [];
  redisConnection.getRedisClient = async () => ({
    eval: async (script, options) => {
      calls.push({ script, options });
      if (script.includes("ISSUED")) return [1, "ISSUED"];
      if (script.includes("CLAIMED")) return [1, "CLAIMED", "a".repeat(64)];
      return 1;
    },
  });
  try {
    await kycOtpStore.issueChallenge({
      userId: "52",
      caseId: 13,
      stepNumber: 1,
      otpHash: "b".repeat(64),
      detailsFingerprint: "c".repeat(64),
      challengeId: "internal-id",
      userRateHash: "d".repeat(64),
      ipRateHash: "e".repeat(64),
    });
    await kycOtpStore.claimChallenge({
      userId: "52",
      caseId: 13,
      stepNumber: 1,
      detailsFingerprint: "c".repeat(64),
      claimId: "claim-id",
      userRateHash: "d".repeat(64),
      ipRateHash: "e".repeat(64),
    });

    assert.equal(calls.length, 2);
    assert.equal(calls[0].options.arguments[9], "60");
    assert.equal(calls[0].options.arguments[10], "300");
    assert.match(calls[0].script, /redis\.call\('DEL', KEYS\[1\]\)/);
    assert.match(calls[0].script, /redis\.call\('EXPIRE', KEYS\[1\]/);
    assert.match(calls[1].script, /redis\.call\('HINCRBY', KEYS\[1\], 'attempts', 1\)/);
    assert.match(calls[1].script, /'state', 'verifying'/);
    assert.equal(calls[1].options.arguments.includes("123456"), false);
    assert.equal(JSON.stringify(calls).includes("203.0.113.10"), false);
  } finally {
    redisConnection.getRedisClient = originalGetRedisClient;
  }
});

test("KYC OTP fails closed when Redis is not configured instead of using in-memory storage", async () => {
  const previousRedisUrl = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    await assert.rejects(
      redisConnection.getRedisClient(),
      (error) => /REDIS_URL is not configured/.test(error.message),
    );
  } finally {
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  }
});

test("KYC service-unavailable errors retain HTTP 503 without exposing internal details", () => {
  const originalError = console.error;
  const logs = [];
  const response = {
    headersSent: false,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  console.error = (...args) => logs.push(args);
  try {
    errorHandler(
      new ApiError(503, "KYC service is temporarily unavailable", ["private"], "SERVICE_UNAVAILABLE"),
      {},
      response,
      () => {},
    );
    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.body, {
      success: false,
      message: "Service temporarily unavailable",
      code: "SERVICE_UNAVAILABLE",
    });
    assert.equal(JSON.stringify(response.body).includes("private"), false);
    assert.equal(JSON.stringify(logs).includes("private"), false);
  } finally {
    console.error = originalError;
  }
});

test("KYC progress model completes Step 1 and recalculates only the approved completion count", async () => {
  const calls = [];
  const connection = {
    execute: async (sql, values) => {
      calls.push({ sql, values });
      if (/SELECT COUNT\(\*\) AS steps_completed/.test(sql)) {
        return [[{ steps_completed: 3 }]];
      }
      if (/UPDATE kyc_steps/.test(sql)) return [{ affectedRows: 1 }];
      return [{ affectedRows: 1 }];
    },
  };

  assert.equal(await basicDetailsModel.completeStep1(connection, 13), true);
  assert.equal(await basicDetailsModel.updateCompletedStepsCount(connection, 13), 3);
  assert.match(calls[0].sql, /SET status = 'completed'/);
  assert.match(calls[0].sql, /completed_at = CURRENT_TIMESTAMP/);
  assert.match(calls[0].sql, /step_number = 1/);
  assert.match(calls[0].sql, /status <> 'completed'/);
  assert.deepEqual(calls[0].values, [13]);
  assert.match(calls[1].sql, /FROM kyc_steps/);
  assert.match(calls[1].sql, /status = 'completed'/);
  assert.deepEqual(calls[1].values, [13]);
  assert.match(calls[2].sql, /UPDATE kyc_cases/);
  assert.match(calls[2].sql, /SET steps_completed = \?/);
  assert.doesNotMatch(calls[2].sql, /current_step|draft/);
  assert.deepEqual(calls[2].values, [3, 13]);
});

test("basic-details service reuses the registered user's case and leaves Step 1 incomplete", async () => {
  const connection = createConnection();
  const { modelCalls, restore, getStep1Status } = mockExistingCase(connection);

  try {
    const result = await basicDetailsService.saveBasicDetails("52", validBody);

    assert.equal(modelCalls.some(([name]) => name === "findCases"), true);
    assert.equal(modelCalls.some(([name]) => name === "insertCase"), false);
    assert.equal(modelCalls.some(([name]) => name === "resetStep1"), true);
    assert.equal(modelCalls.some(([name]) => name === "updateCase"), true);
    assert.equal(modelCalls.some(([name]) => name === "updateUser"), true);
    assert.equal(getStep1Status(), "in_progress");
    assert.deepEqual(
      modelCalls.find(([name]) => name === "updateCase"),
      ["updateCase", 13, validBody.businessType],
    );
    assert.deepEqual(
      modelCalls.find(([name]) => name === "updateUser"),
      ["updateUser", "52", {
        shopAddress: validBody.shopAddress,
        city: validBody.city,
        pincode: validBody.pincode,
      }],
    );
    assert.deepEqual(result.kyc, {
      status: "pending",
      steps_completed: 0,
      business_type: "Retail Store",
    });
    assert.deepEqual(connection.calls, ["begin", "commit", "release"]);
  } finally {
    restore();
  }
});

test("basic-details service refuses to create a missing or ambiguous KYC case", async () => {
  const connection = createConnection();
  const restore = replaceModelMethods({
    getConnection: async () => connection,
    findActiveUserForUpdate: async () => ({ id: "52", status: "active" }),
    findCasesByUserIdForUpdate: async () => [],
  });

  try {
    await assert.rejects(
      basicDetailsService.saveBasicDetails("52", validBody),
      (error) => error.code === "KYC_CASE_NOT_FOUND" && error.statusCode === 404,
    );
    assert.deepEqual(connection.calls, ["begin", "rollback", "release"]);

    basicDetailsModel.findCasesByUserIdForUpdate = async () => [
      { id: 13, status: "pending" },
      { id: 14, status: "pending" },
    ];
    await assert.rejects(
      basicDetailsService.saveBasicDetails("52", validBody),
      (error) => error.code === "KYC_CASE_AMBIGUOUS" && error.statusCode === 409,
    );
  } finally {
    restore();
  }
});

test("basic-details service rejects non-pending cases and rolls back database errors", async () => {
  const connection = createConnection();
  const caseMocks = mockExistingCase(connection, {
    kycCase: { status: "submitted" },
  });

  try {
    await assert.rejects(
      basicDetailsService.saveBasicDetails("52", validBody),
      (error) => error.code === "KYC_CASE_NOT_EDITABLE" && error.statusCode === 400,
    );
    assert.deepEqual(connection.calls, ["begin", "rollback", "release"]);
  } finally {
    caseMocks.restore();
  }

  const failingConnection = createConnection();
  const errorRestore = replaceModelMethods({
    getConnection: async () => failingConnection,
    findActiveUserForUpdate: async () => {
      throw new Error("database unavailable");
    },
  });
  try {
    await assert.rejects(
      basicDetailsService.saveBasicDetails("52", validBody),
      (error) => error.code === "SERVICE_UNAVAILABLE" && error.statusCode === 503,
    );
    assert.deepEqual(failingConnection.calls, ["begin", "rollback", "release"]);
  } finally {
    errorRestore();
  }
});

test("basic-details controller derives the target user only from authenticated request context", async () => {
  const originalSave = basicDetailsService.saveBasicDetails;
  let captured;
  basicDetailsService.saveBasicDetails = async (userId, body) => {
    captured = { userId, body };
    return { kyc: { status: "pending", steps_completed: 0 } };
  };

  try {
    const res = {
      statusCode: undefined,
      body: undefined,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        this.body = body;
        return this;
      },
    };
    await basicDetailsController.saveBasicDetails(
      { user: { id: "52" }, validatedBody: { ...validBody, userId: 99 } },
      res,
      (error) => { throw error; },
    );
    await new Promise((resolve) => setImmediate(resolve));

    assert.deepEqual(captured, { userId: "52", body: { ...validBody, userId: 99 } });
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.success, true);
  } finally {
    basicDetailsService.saveBasicDetails = originalSave;
  }
});

test("mounted KYC Basic Details route rejects unauthenticated requests", async () => {
  const server = app.listen(0);
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/api/kyc/basic-details`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(validBody),
    });
    const body = await response.json();

    assert.equal(response.status, 401);
    assert.equal(body.success, false);
    assert.equal(body.code, "UNAUTHORIZED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("mounted KYC OTP endpoints reject unauthenticated requests", async () => {
  const server = app.listen(0);
  try {
    await new Promise((resolve, reject) => {
      server.once("listening", resolve);
      server.once("error", reject);
    });
    const address = server.address();
    for (const [path, body] of [
      ["request-otp", {}],
      ["verify-otp", { otp: "123456" }],
    ]) {
      const response = await fetch(
        `http://127.0.0.1:${address.port}/api/kyc/basic-details/${path}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = await response.json();
      assert.equal(response.status, 401);
      assert.equal(result.success, false);
      assert.equal(result.code, "UNAUTHORIZED");
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
