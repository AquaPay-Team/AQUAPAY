
import test from "node:test";
import assert from "node:assert/strict";

import { createDigilockerModel } from "../digilocker.model.js";

const VALID_CASE = [{ id: 13 }];
const VALID_AADHAAR = [
  { id: 31, verified_name: "Rahul Kumar Sharma" },
];

function createTestModel(responses) {
  let callIndex = 0;

  const dbPool = {
    async execute() {
      const response = responses[callIndex++];

      if (!response) {
        throw new Error("Unexpected database query");
      }

      return [response];
    },
  };

  return {
    model: createDigilockerModel({ dbPool, env: { NODE_ENV: "test" } }),
    getCallCount: () => callIndex,
  };
}

test("returns the verified Aadhaar name for a valid user", async () => {
  const { model, getCallCount } = createTestModel([
    VALID_CASE,
    VALID_AADHAAR,
  ]);

  const name = await model.getVerifiedAadhaarName("52");

  assert.equal(name, "Rahul Kumar Sharma");
  assert.equal(getCallCount(), 2);
});

test("rejects an invalid user ID", async () => {
  const { model, getCallCount } = createTestModel([]);

  await assert.rejects(
    model.getVerifiedAadhaarName(null),
    { message: "INVALID_USER_ID" },
  );

  assert.equal(getCallCount(), 0);
});

test("rejects when the KYC case does not exist", async () => {
  const { model } = createTestModel([[]]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "KYC_CASE_NOT_FOUND" },
  );
});

test("rejects multiple KYC cases", async () => {
  const { model } = createTestModel([
    [{ id: 13 }, { id: 14 }],
  ]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "KYC_CASE_AMBIGUOUS" },
  );
});

test("rejects when no verified Aadhaar record exists", async () => {
  const { model } = createTestModel([
    VALID_CASE,
    [],
  ]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "AADHAAR_VERIFICATION_NOT_COMPLETED" },
  );
});

test("rejects multiple verified Aadhaar records", async () => {
  const { model } = createTestModel([
    VALID_CASE,
    [
      { id: 31, verified_name: "Rahul Kumar Sharma" },
      { id: 32, verified_name: "Rahul Sharma" },
    ],
  ]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "AADHAAR_VERIFICATION_AMBIGUOUS" },
  );
});

test("rejects an empty verified Aadhaar name", async () => {
  const { model } = createTestModel([
    VALID_CASE,
    [{ id: 31, verified_name: "   " }],
  ]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "AADHAAR_VERIFIED_NAME_UNAVAILABLE" },
  );
});

test("rejects a verified Aadhaar name exceeding 100 characters", async () => {
  const { model } = createTestModel([
    VALID_CASE,
    [{ id: 31, verified_name: "A".repeat(101) }],
  ]);

  await assert.rejects(
    model.getVerifiedAadhaarName("52"),
    { message: "AADHAAR_VERIFIED_NAME_UNAVAILABLE" },
  );
});

test("production startup guard rejects persisted development-only PAN mock records", async () => {
  let capturedParams;
  const model = createDigilockerModel({
    dbPool: {
      async execute(_sql, params) {
        capturedParams = params;
        return [[{ development_unverified_count: 1 }]];
      },
    },
    env: { NODE_ENV: "production" },
  });
  await assert.rejects(model.assertNoDevelopmentUnverifiedRecords(), /Production startup blocked/);
  assert.deepEqual(capturedParams, [
    "idto_digilocker_v1_dev_unverified",
    "idto_pan_detailed_v2_mock",
  ]);
});
