import test from "node:test";
import assert from "node:assert/strict";

import { validateSubmitKyc } from "./submission.validator.js";
import submissionController from "./submission.controller.js";
import submissionService from "./submission.service.js";
import submissionModel from "./submission.model.js";

const validSubmissionEvidence = {
  basicDetails: {
    business_type: "Retail",
    address: "10 Sample Road",
    city: "Pune",
    pincode: "411001",
  },
  verificationRecords: [
    {
      verification_type: "aadhaar",
      provider: "idto_digilocker_v1",
      verified_name: "Synthetic Aadhaar Name",
      masked_identifier: "XXXXXX1234",
      has_encrypted_identity: 1,
    },
    {
      verification_type: "pan",
      provider: "idto_pan_detailed_v2",
      verified_name: "Synthetic PAN Name",
      masked_identifier: "XXXXX2345F",
      has_encrypted_identity: 1,
    },
  ],
  bankAccounts: [
    { verification_status: "verified", account_number_encrypted: Buffer.from("encrypted") },
  ],
  latestMedia: [
    { asset_type: "shop_image", status: "uploaded" },
    { asset_type: "selfie", status: "verified" },
    { asset_type: "consent_video", status: "uploaded" },
  ],
  agreementAcceptance: { id: 1 },
};

// Helper to mock express req, res, next
function createMockReqRes({ body = {}, user = { id: 1 } } = {}) {
  const req = {
    body,
    user,
    headers: {},
  };
  let statusCode = 200;
  let responseData = null;

  const res = {
    status(code) {
      statusCode = code;
      return res;
    },
    json(data) {
      responseData = data;
      return res;
    },
  };

  const next = (error) => {
    if (error) {
      throw error;
    }
  };

  return {
    req,
    res,
    next,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
  };
}

// ----------------------------------------------------
// Validator Tests
// ----------------------------------------------------
test("submission.validator: rejects unexpected fields", () => {
  const { req, res, next } = createMockReqRes({
    body: { confirm: true, badField: 123 },
  });
  assert.throws(() => validateSubmitKyc(req, res, next), (err) => {
    assert.match(err.message, /Unexpected request field: badField/);
    return true;
  });
});

test("submission.validator: rejects non-boolean or false confirm flag", () => {
  const { req, res, next } = createMockReqRes({
    body: { confirm: false },
  });
  assert.throws(() => validateSubmitKyc(req, res, next), (err) => {
    assert.match(err.message, /Confirm flag must be true if provided/);
    return true;
  });
});

test("submission.validator: rejects oversized notes", () => {
  const { req, res, next } = createMockReqRes({
    body: { notes: "A".repeat(501) },
  });
  assert.throws(() => validateSubmitKyc(req, res, next), (err) => {
    assert.match(err.message, /Notes must not exceed 500 characters/);
    return true;
  });
});

test("submission.validator: accepts empty or valid body", () => {
  const { req, res, next } = createMockReqRes({
    body: { confirm: true, notes: "All documents checked" },
  });
  validateSubmitKyc(req, res, next);
  assert.equal(req.validatedBody.confirm, true);
  assert.equal(req.validatedBody.notes, "All documents checked");
});

// ----------------------------------------------------
// Controller Tests
// ----------------------------------------------------
test("submission.controller: getSubmissionStatus rejects unauthenticated request", async () => {
  let capturedError = null;
  const req = { user: null };
  const res = {};
  const next = (err) => {
    capturedError = err;
  };
  await submissionController.getSubmissionStatus(req, res, next);
  assert.equal(capturedError?.code, "UNAUTHORIZED");
});

test("submission.controller: submitKycApplication rejects unauthenticated request", async () => {
  let capturedError = null;
  const req = { user: null, validatedBody: { confirm: true } };
  const res = {};
  const next = (err) => {
    capturedError = err;
  };
  await submissionController.submitKycApplication(req, res, next);
  assert.equal(capturedError?.code, "UNAUTHORIZED");
});

// ----------------------------------------------------
// Service Tests
// ----------------------------------------------------
test("submission.service: getSubmissionStatus detects incomplete steps", async () => {
  const originalFindActiveUser = submissionModel.findActiveUser;
  const originalFindCasesByUserId = submissionModel.findCasesByUserId;
  const originalFindStepsByCaseId = submissionModel.findStepsByCaseId;

  submissionModel.findActiveUser = async () => ({ id: 1, status: "active" });
  submissionModel.findCasesByUserId = async () => [
    { id: 25, user_id: 1, status: "pending", steps_completed: 4 },
  ];
  submissionModel.findStepsByCaseId = async () => [
    { step_number: 1, status: "completed" },
    { step_number: 2, status: "completed" },
    { step_number: 3, status: "completed" },
    { step_number: 4, status: "completed" },
    { step_number: 5, status: "pending" }, // Step 5 incomplete!
    { step_number: 6, status: "pending" }, // Step 6 incomplete!
    { step_number: 7, status: "pending" },
  ];

  try {
    const status = await submissionService.getSubmissionStatus(1);
    assert.equal(status.isReadyForSubmission, false);
    assert.equal(status.incompleteSteps.length, 2);
    assert.equal(status.incompleteSteps[0].stepNumber, 5);
    assert.equal(status.incompleteSteps[1].stepNumber, 6);
  } finally {
    submissionModel.findActiveUser = originalFindActiveUser;
    submissionModel.findCasesByUserId = originalFindCasesByUserId;
    submissionModel.findStepsByCaseId = originalFindStepsByCaseId;
  }
});

test("submission.service: submitKycApplication rejects when steps 1-6 are not completed", async () => {
  const originalGetConnection = submissionModel.getConnection;
  const originalFindActiveUserForUpdate = submissionModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = submissionModel.findCasesByUserIdForUpdate;
  const originalFindStepsByCaseId = submissionModel.findStepsByCaseId;

  let rolledBack = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {
      rolledBack = true;
    },
    release: () => {},
  };

  submissionModel.getConnection = async () => mockConnection;
  submissionModel.findActiveUserForUpdate = async () => ({ id: 1, status: "active" });
  submissionModel.findCasesByUserIdForUpdate = async () => [
    { id: 25, user_id: 1, status: "pending", steps_completed: 5 },
  ];
  submissionModel.findStepsByCaseId = async () => [
    { step_number: 1, status: "completed" },
    { step_number: 2, status: "completed" },
    { step_number: 3, status: "completed" },
    { step_number: 4, status: "completed" },
    { step_number: 5, status: "completed" },
    { step_number: 6, status: "pending" }, // step 6 incomplete
    { step_number: 7, status: "pending" },
  ];

  try {
    await assert.rejects(
      async () => {
        await submissionService.submitKycApplication(1);
      },
      (err) => {
        assert.equal(err.code, "INCOMPLETE_KYC_STEPS");
        assert.match(err.message, /Agent Agreement Acceptance/);
        return true;
      },
    );
    assert.equal(rolledBack, true);
  } finally {
    submissionModel.getConnection = originalGetConnection;
    submissionModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    submissionModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
    submissionModel.findStepsByCaseId = originalFindStepsByCaseId;
  }
});

test("submission.service: rejects completed step flags when durable evidence is missing", async () => {
  const originalGetConnection = submissionModel.getConnection;
  const originalFindActiveUserForUpdate = submissionModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = submissionModel.findCasesByUserIdForUpdate;
  const originalFindStepsByCaseId = submissionModel.findStepsByCaseId;
  const originalFindSubmissionEvidence = submissionModel.findSubmissionEvidence;
  const originalSubmitKycCase = submissionModel.submitKycCase;
  let rolledBack = false;
  let submitted = false;
  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => { rolledBack = true; },
    release: () => {},
  };
  submissionModel.getConnection = async () => mockConnection;
  submissionModel.findActiveUserForUpdate = async () => ({ id: 1, status: "active" });
  submissionModel.findCasesByUserIdForUpdate = async () => [
    { id: 25, user_id: 1, status: "pending", steps_completed: 6 },
  ];
  submissionModel.findStepsByCaseId = async () =>
    [1, 2, 3, 4, 5, 6].map((step_number) => ({ step_number, status: "completed" }));
  submissionModel.findSubmissionEvidence = async () => ({
    ...validSubmissionEvidence,
    verificationRecords: [validSubmissionEvidence.verificationRecords[0]],
  });
  submissionModel.submitKycCase = async () => { submitted = true; };

  try {
    await assert.rejects(
      submissionService.submitKycApplication(1),
      (error) => error.code === "INCOMPLETE_KYC_EVIDENCE",
    );
    assert.equal(rolledBack, true);
    assert.equal(submitted, false);
  } finally {
    submissionModel.getConnection = originalGetConnection;
    submissionModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    submissionModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
    submissionModel.findStepsByCaseId = originalFindStepsByCaseId;
    submissionModel.findSubmissionEvidence = originalFindSubmissionEvidence;
    submissionModel.submitKycCase = originalSubmitKycCase;
  }
});

test("submission evidence rejects missing names, plaintext Aadhaar IDs, mocks, and absent encrypted payloads", () => {
  const invalidRecords = [
    { ...validSubmissionEvidence.verificationRecords[0], verified_name: "  " },
    { ...validSubmissionEvidence.verificationRecords[0], provider: "idto_digilocker_v1_dev_unverified" },
    { ...validSubmissionEvidence.verificationRecords[0], has_encrypted_identity: 0 },
  ];

  for (const invalidRecord of invalidRecords) {
    const missing = submissionService.missingSubmissionEvidenceSteps({
      ...validSubmissionEvidence,
      verificationRecords: [invalidRecord, validSubmissionEvidence.verificationRecords[1]],
    });
    assert.ok(missing.includes(2));
    assert.ok(!missing.includes(3));
  }
});

test("submission evidence query scopes records to the user and joins encrypted identity payloads", async () => {
  const statements = [];
  const connection = {
    async execute(sql, params) {
      statements.push({ sql, params });
      return [[]];
    },
  };

  await submissionModel.findSubmissionEvidence(connection, 52, 13, "AGENT", "1");

  const verificationQuery = statements.find(({ sql }) => sql.includes("FROM kyc_verifications verification"));
  assert.ok(verificationQuery);
  assert.deepEqual(verificationQuery.params, [52, 13]);
  assert.match(verificationQuery.sql, /verification_case\.user_id = \?/);
  assert.match(verificationQuery.sql, /JOIN kyc_identity_data identity_data/);
  assert.match(verificationQuery.sql, /identity_data\.user_id = verification_case\.user_id/);
  assert.match(verificationQuery.sql, /identity_data\.identity_type = verification\.verification_type/);
  assert.match(verificationQuery.sql, /idto_digilocker_v1/);
  assert.match(verificationQuery.sql, /idto_pan_detailed_v2/);
});

test("submission.service: submitKycApplication transactionally submits when all steps 1-6 are completed", async () => {
  const originalGetConnection = submissionModel.getConnection;
  const originalFindActiveUserForUpdate = submissionModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = submissionModel.findCasesByUserIdForUpdate;
  const originalFindStepsByCaseId = submissionModel.findStepsByCaseId;
  const originalFindSubmissionEvidence = submissionModel.findSubmissionEvidence;
  const originalSubmitKycCase = submissionModel.submitKycCase;
  const originalCompleteStep7 = submissionModel.completeStep7;
  const originalUpdateCompletedStepsCount = submissionModel.updateCompletedStepsCount;
  const originalInsertStatusHistory = submissionModel.insertStatusHistory;

  let committed = false;
  let caseSubmitted = false;
  let step7Completed = false;
  let historyInserted = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {},
    release: () => {},
  };

  submissionModel.getConnection = async () => mockConnection;
  submissionModel.findActiveUserForUpdate = async () => ({ id: 1, status: "active" });
  submissionModel.findCasesByUserIdForUpdate = async () => [
    { id: 25, user_id: 1, status: "pending", steps_completed: 6 },
  ];
  submissionModel.findStepsByCaseId = async () => [
    { step_number: 1, status: "completed" },
    { step_number: 2, status: "completed" },
    { step_number: 3, status: "completed" },
    { step_number: 4, status: "completed" },
    { step_number: 5, status: "completed" },
    { step_number: 6, status: "completed" },
    { step_number: 7, status: "pending" },
  ];
  submissionModel.findSubmissionEvidence = async () => validSubmissionEvidence;
  submissionModel.submitKycCase = async () => {
    caseSubmitted = true;
    return true;
  };
  submissionModel.completeStep7 = async () => {
    step7Completed = true;
    return true;
  };
  submissionModel.updateCompletedStepsCount = async () => 7;
  submissionModel.insertStatusHistory = async () => {
    historyInserted = true;
    return 101;
  };

  try {
    const result = await submissionService.submitKycApplication(1, {
      notes: "Submitted via portal",
    });

    assert.equal(result.alreadySubmitted, false);
    assert.equal(result.status, "submitted");
    assert.equal(result.steps_completed, 7);
    assert.equal(committed, true);
    assert.equal(caseSubmitted, true);
    assert.equal(step7Completed, true);
    assert.equal(historyInserted, true);
  } finally {
    submissionModel.getConnection = originalGetConnection;
    submissionModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    submissionModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
    submissionModel.findStepsByCaseId = originalFindStepsByCaseId;
    submissionModel.findSubmissionEvidence = originalFindSubmissionEvidence;
    submissionModel.submitKycCase = originalSubmitKycCase;
    submissionModel.completeStep7 = originalCompleteStep7;
    submissionModel.updateCompletedStepsCount = originalUpdateCompletedStepsCount;
    submissionModel.insertStatusHistory = originalInsertStatusHistory;
  }
});

test("submission.service: submitKycApplication is idempotent if already submitted", async () => {
  const originalGetConnection = submissionModel.getConnection;
  const originalFindActiveUserForUpdate = submissionModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = submissionModel.findCasesByUserIdForUpdate;

  let committed = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {},
    release: () => {},
  };

  submissionModel.getConnection = async () => mockConnection;
  submissionModel.findActiveUserForUpdate = async () => ({ id: 1, status: "active" });
  submissionModel.findCasesByUserIdForUpdate = async () => [
    {
      id: 25,
      user_id: 1,
      status: "submitted",
      submitted_at: "2026-11-03T11:00:00.000Z",
      steps_completed: 7,
    },
  ];

  try {
    const result = await submissionService.submitKycApplication(1);
    assert.equal(result.alreadySubmitted, true);
    assert.equal(result.status, "submitted");
    assert.equal(result.steps_completed, 7);
    assert.equal(committed, true);
  } finally {
    submissionModel.getConnection = originalGetConnection;
    submissionModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    submissionModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
  }
});

