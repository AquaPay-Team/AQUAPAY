import test from "node:test";
import assert from "node:assert/strict";
import { createPanModel } from "../pan.model.js";

function createHarness({ aadhaarStep = "completed", panStep = "pending", existingVerification = null, activeAttempt = 0, identityError = null } = {}) {
  const state = {
    aadhaarStep,
    panStep,
    verification: existingVerification ? { ...existingVerification } : null,
    calls: [],
  };
  const tx = { begin: 0, commit: 0, rollback: 0, release: 0 };
  function connection() {
    return {
      async beginTransaction() { tx.begin++; },
      async commit() { tx.commit++; },
      async rollback() { tx.rollback++; },
      release() { tx.release++; },
      async execute(sql, params = []) {
        state.calls.push({ sql, params });
        if (/FROM users\s+WHERE id/i.test(sql)) return [[{ id: 42, status: "active" }]];
        if (/FROM kyc_cases/i.test(sql)) return [[{ id: 9, status: "pending" }]];
        if (/SELECT COUNT\(\*\)/i.test(sql)) return [[{ steps_completed: 3 }]];
        if (/FROM kyc_steps/i.test(sql)) {
          if (/step_number IN \(2, 3\)/i.test(sql)) {
            return [[{ step_number: 2, status: state.aadhaarStep }, { step_number: 3, status: state.panStep }]];
          }
          return [[{ steps_completed: state.panStep === "completed" ? 3 : 2 }]];
        }
        if (/FROM kyc_verifications/i.test(sql) && /verification_type = 'aadhaar'/i.test(sql)) {
          return [[{ id: 7, verified_name: "Rahul Kumar Sharma" }]];
        }
        if (/FROM kyc_verifications/i.test(sql) && /verification_type = 'pan'/i.test(sql)) {
          if (state.verification && /WHERE id = \?/i.test(sql)) return [[state.verification]];
          return [state.verification ? [{ ...state.verification, active_attempt: activeAttempt }] : []];
        }
        if (/INSERT INTO kyc_verifications/i.test(sql)) {
          state.verification = { id: 11, status: "pending", provider: params[1] };
          return [{ insertId: 11, affectedRows: 1 }];
        }
        if (/UPDATE kyc_verifications/i.test(sql) && /status = 'verified'/i.test(sql)) {
          state.verification.status = "verified";
          state.verification.provider = params[0];
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_verifications/i.test(sql) && /status = 'failed'/i.test(sql)) {
          state.verification.status = "failed";
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_verifications/i.test(sql)) {
          state.verification = { id: params[1], status: "pending", provider: params[0] };
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_steps/i.test(sql) && /status = 'completed'/i.test(sql)) {
          state.panStep = "completed";
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_steps/i.test(sql) && /status = 'failed'/i.test(sql)) {
          state.panStep = "failed";
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_steps/i.test(sql)) {
          state.panStep = "in_progress";
          return [{ affectedRows: 1 }];
        }
        if (/UPDATE kyc_cases/i.test(sql)) return [{ affectedRows: 1 }];
        throw new Error(`Unexpected SQL in PAN model test: ${sql}`);
      },
    };
  }
  const identityCalls = [];
  const model = createPanModel({
    dbPool: { async getConnection() { return connection(); } },
    identityModel: {
      async insertIdentityData(conn, input) {
        identityCalls.push(input);
        if (identityError) throw identityError;
      },
    },
  });
  return { model, state, tx, identityCalls };
}

const completionData = {
  userId: "42",
  caseId: "9",
  verificationId: "11",
  panNumber: "ABCDE1234F",
  maskedIdentifier: "XXXXXX234F",
  verifiedName: "Rahul Kumar Sharma",
  aadhaarVerifiedName: "Rahul Kumar Sharma",
  providerName: "idto_pan_detailed_v2",
};

test("PAN model creates a pending attempt only after locking and rechecking Aadhaar Step 2", async () => {
  const harness = createHarness();
  const result = await harness.model.createPendingVerification(42, {
    aadhaarVerifiedName: "Rahul Kumar Sharma",
  });
  assert.deepEqual(result, { userId: "42", caseId: "9", verificationId: "11" });
  assert.equal(harness.state.panStep, "in_progress");
  assert.equal(harness.tx.commit, 1);
  assert.equal(harness.tx.rollback, 0);
  assert.ok(harness.state.calls.filter((call) => /FOR UPDATE/i.test(call.sql)).length >= 4);
  assert.equal(harness.state.calls.some((call) => call.params.includes("ABCDE1234F")), false);
});

test("PAN model refuses initiation before completed Aadhaar Step 2", async () => {
  const harness = createHarness({ aadhaarStep: "in_progress" });
  await assert.rejects(harness.model.createPendingVerification(42, {
    aadhaarVerifiedName: "Rahul Kumar Sharma",
  }), { message: "KYC_PREREQUISITE_NOT_COMPLETED" });
  assert.equal(harness.tx.commit, 0);
  assert.equal(harness.tx.rollback, 1);
});

test("PAN model rejects a concurrent active verification attempt", async () => {
  const harness = createHarness({
    panStep: "in_progress",
    existingVerification: { id: 11, status: "pending", provider: "idto_pan_detailed_v2" },
    activeAttempt: 1,
  });
  await assert.rejects(harness.model.createPendingVerification(42, {
    aadhaarVerifiedName: "Rahul Kumar Sharma",
  }), { message: "VERIFICATION_IN_PROGRESS" });
  assert.equal(harness.tx.commit, 0);
  assert.equal(harness.tx.rollback, 1);
});

test("PAN model marks failed attempts retryable without overwriting verified identity", async () => {
  const harness = createHarness({
    panStep: "in_progress",
    existingVerification: { id: 11, status: "pending", provider: "idto_pan_detailed_v2" },
  });
  await harness.model.failVerification({
    userId: "42", caseId: "9", verificationId: "11", failureCode: "PAN_NAME_MISMATCH",
  });
  assert.equal(harness.state.verification.status, "failed");
  assert.equal(harness.state.panStep, "failed");
  assert.equal(harness.tx.commit, 1);

  const retry = await harness.model.createPendingVerification(42, {
    aadhaarVerifiedName: "Rahul Kumar Sharma",
  });
  assert.equal(retry.verificationId, "11");
  assert.equal(harness.state.verification.status, "pending");
  assert.equal(harness.state.panStep, "in_progress");
  assert.equal(harness.tx.commit, 2);
});

test("PAN model completion encrypts identity and commits verification, Step 3 and progress together", async () => {
  const harness = createHarness({
    panStep: "in_progress",
    existingVerification: { id: 11, status: "pending", provider: "idto_pan_detailed_v2" },
  });
  const result = await harness.model.completeVerification(completionData);
  assert.deepEqual(result, { stepNumber: 3, steps_completed: 3 });
  assert.equal(harness.identityCalls.length, 1);
  assert.deepEqual(harness.identityCalls[0].payload, { panNumber: "ABCDE1234F" });
  assert.equal(harness.state.verification.status, "verified");
  assert.equal(harness.state.panStep, "completed");
  assert.equal(harness.tx.commit, 1);
  assert.equal(harness.tx.rollback, 0);
});

test("PAN model rolls back identity and step changes when encrypted persistence fails", async () => {
  const harness = createHarness({
    panStep: "in_progress",
    existingVerification: { id: 11, status: "pending", provider: "idto_pan_detailed_v2" },
    identityError: new Error("encryption insert failed"),
  });
  await assert.rejects(harness.model.completeVerification(completionData));
  assert.equal(harness.tx.commit, 0);
  assert.equal(harness.tx.rollback, 1);
  assert.equal(harness.state.panStep, "in_progress");
});

test("PAN model never overwrites an already verified record", async () => {
  const harness = createHarness({
    panStep: "completed",
    existingVerification: { id: 11, status: "verified", provider: "idto_pan_detailed_v2" },
  });
  await assert.rejects(harness.model.completeVerification(completionData), {
    message: "VERIFICATION_ALREADY_COMPLETED",
  });
  assert.equal(harness.identityCalls.length, 0);
  assert.equal(harness.tx.rollback, 1);
});
