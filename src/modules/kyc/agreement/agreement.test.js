import test from "node:test";
import assert from "node:assert/strict";

import { validateAcceptAgreement } from "./agreement.validator.js";
import agreementController from "./agreement.controller.js";
import agreementService from "./agreement.service.js";
import agreementModel from "./agreement.model.js";

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
test("agreement.validator: rejects non-object body", () => {
  const { req, res, next } = createMockReqRes({ body: null });
  assert.throws(() => validateAcceptAgreement(req, res, next), {
    message: "Request body must be a valid JSON object",
  });
});

test("agreement.validator: rejects unexpected fields", () => {
  const { req, res, next } = createMockReqRes({
    body: { accepted: true, unexpected: "bad" },
  });
  assert.throws(() => validateAcceptAgreement(req, res, next), (err) => {
    assert.match(err.message, /Unexpected request field: unexpected/);
    return true;
  });
});

test("agreement.validator: rejects when accepted is missing or false", () => {
  const { req, res, next } = createMockReqRes({
    body: { accepted: false },
  });
  assert.throws(() => validateAcceptAgreement(req, res, next), (err) => {
    assert.match(err.message, /must accept the agreement terms/);
    return true;
  });
});

test("agreement.validator: accepts valid acceptance and sets defaults", () => {
  const { req, res, next } = createMockReqRes({
    body: { accepted: true },
  });
  validateAcceptAgreement(req, res, next);
  assert.equal(req.validatedBody.accepted, true);
  assert.equal(req.validatedBody.agreementCode, "AQUAPAY_AGENT_AGREEMENT");
  assert.equal(req.validatedBody.agreementVersion, "v1.0");
});

test("agreement.validator: accepts custom agreement code and version", () => {
  const { req, res, next } = createMockReqRes({
    body: {
      accepted: true,
      agreementCode: "CUSTOM_AGREEMENT",
      agreementVersion: "v2.1",
    },
  });
  validateAcceptAgreement(req, res, next);
  assert.equal(req.validatedBody.accepted, true);
  assert.equal(req.validatedBody.agreementCode, "CUSTOM_AGREEMENT");
  assert.equal(req.validatedBody.agreementVersion, "v2.1");
});

test("agreement.validator: rejects oversized code or version", () => {
  const { req, res, next } = createMockReqRes({
    body: {
      accepted: true,
      agreementCode: "A".repeat(101),
    },
  });
  assert.throws(() => validateAcceptAgreement(req, res, next), (err) => {
    assert.match(err.message, /must not exceed 100 characters/);
    return true;
  });
});

// ----------------------------------------------------
// Controller Tests
// ----------------------------------------------------
test("agreement.controller: getAgreementDetails rejects unauthenticated request", async () => {
  let capturedError = null;
  const req = { user: null };
  const res = {};
  const next = (err) => {
    capturedError = err;
  };
  await agreementController.getAgreementDetails(req, res, next);
  assert.equal(capturedError?.code, "UNAUTHORIZED");
});

test("agreement.controller: acceptAgreement rejects unauthenticated request", async () => {
  let capturedError = null;
  const req = { user: null, validatedBody: { accepted: true } };
  const res = {};
  const next = (err) => {
    capturedError = err;
  };
  await agreementController.acceptAgreement(req, res, next);
  assert.equal(capturedError?.code, "UNAUTHORIZED");
});

// ----------------------------------------------------
// Service Tests
// ----------------------------------------------------
test("agreement.service: getAgreementDetails returns structured agent details", async () => {
  const originalFindActiveUser = agreementModel.findActiveUser;
  const originalFindCasesByUserId = agreementModel.findCasesByUserId;
  const originalFindAgreementAcceptance = agreementModel.findAgreementAcceptance;

  agreementModel.findActiveUser = async (userId) => ({
    id: userId,
    name: "Ramesh Patel",
    email: "ramesh@example.com",
    mobile: "+919876543210",
    role_name: "Retailer",
    role_slug: "RT",
    shopname: "Patel Enterprises",
    address: "123 Market Rd",
    city: "Ahmedabad",
    state: "Gujarat",
    pincode: "380001",
    status: "active",
  });

  agreementModel.findCasesByUserId = async () => [
    {
      id: 10,
      user_id: 1,
      status: "pending",
      steps_completed: 5,
      business_type: "Retail Store",
    },
  ];

  agreementModel.findAgreementAcceptance = async () => null;

  try {
    const details = await agreementService.getAgreementDetails(1);
    assert.equal(details.title, "AquaPay Agent Agreement");
    assert.equal(details.agreementCode, "AQUAPAY_AGENT_AGREEMENT");
    assert.equal(details.isAccepted, false);
    assert.equal(details.clauses.length, 10);
    assert.equal(details.signSection.signatureName, "Ramesh Patel");
    assert.equal(details.agentDetails.name, "Ramesh Patel");
    assert.equal(details.agentDetails.role, "Retailer");
    assert.equal(details.agentDetails.businessType, "Retail Store");
  } finally {
    agreementModel.findActiveUser = originalFindActiveUser;
    agreementModel.findCasesByUserId = originalFindCasesByUserId;
    agreementModel.findAgreementAcceptance = originalFindAgreementAcceptance;
  }
});

test("agreement.service: acceptAgreement transactionally completes step 6", async () => {
  const originalGetConnection = agreementModel.getConnection;
  const originalFindActiveUserForUpdate = agreementModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = agreementModel.findCasesByUserIdForUpdate;
  const originalFindStepByCaseIdAndNumber = agreementModel.findStepByCaseIdAndNumber;
  const originalInsertAgreementAcceptance = agreementModel.insertAgreementAcceptance;
  const originalCompleteStep6 = agreementModel.completeStep6;
  const originalUpdateCompletedStepsCount = agreementModel.updateCompletedStepsCount;

  let committed = false;
  let rolledBack = false;
  let step6Completed = false;
  let acceptanceInserted = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {
      committed = true;
    },
    rollback: async () => {
      rolledBack = true;
    },
    release: () => {},
  };

  agreementModel.getConnection = async () => mockConnection;

  agreementModel.findActiveUserForUpdate = async () => ({
    id: 1,
    status: "active",
  });

  agreementModel.findCasesByUserIdForUpdate = async () => [
    {
      id: 42,
      user_id: 1,
      status: "pending",
      steps_completed: 5,
    },
  ];

  agreementModel.findStepByCaseIdAndNumber = async () => ({
    id: 106,
    case_id: 42,
    step_number: 6,
    status: "pending",
  });

  agreementModel.insertAgreementAcceptance = async () => {
    acceptanceInserted = true;
    return true;
  };

  agreementModel.completeStep6 = async () => {
    step6Completed = true;
    return true;
  };

  agreementModel.updateCompletedStepsCount = async () => 6;

  try {
    const result = await agreementService.acceptAgreement(1, {
      accepted: true,
      agreementCode: "AQUAPAY_AGENT_AGREEMENT",
      agreementVersion: "v1.0",
    });

    assert.equal(result.accepted, true);
    assert.equal(result.agreementCode, "AQUAPAY_AGENT_AGREEMENT");
    assert.equal(result.steps_completed, 6);
    assert.equal(committed, true);
    assert.equal(rolledBack, false);
    assert.equal(step6Completed, true);
    assert.equal(acceptanceInserted, true);
  } finally {
    agreementModel.getConnection = originalGetConnection;
    agreementModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    agreementModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
    agreementModel.findStepByCaseIdAndNumber = originalFindStepByCaseIdAndNumber;
    agreementModel.insertAgreementAcceptance = originalInsertAgreementAcceptance;
    agreementModel.completeStep6 = originalCompleteStep6;
    agreementModel.updateCompletedStepsCount = originalUpdateCompletedStepsCount;
  }
});

test("agreement.service: acceptAgreement rolls back if case is already submitted", async () => {
  const originalGetConnection = agreementModel.getConnection;
  const originalFindActiveUserForUpdate = agreementModel.findActiveUserForUpdate;
  const originalFindCasesByUserIdForUpdate = agreementModel.findCasesByUserIdForUpdate;

  let rolledBack = false;

  const mockConnection = {
    beginTransaction: async () => {},
    commit: async () => {},
    rollback: async () => {
      rolledBack = true;
    },
    release: () => {},
  };

  agreementModel.getConnection = async () => mockConnection;
  agreementModel.findActiveUserForUpdate = async () => ({
    id: 1,
    status: "active",
  });
  agreementModel.findCasesByUserIdForUpdate = async () => [
    {
      id: 42,
      user_id: 1,
      status: "submitted", // already submitted!
      steps_completed: 6,
    },
  ];

  try {
    await assert.rejects(
      async () => {
        await agreementService.acceptAgreement(1, { accepted: true });
      },
      (err) => {
        assert.equal(err.code, "KYC_CASE_NOT_EDITABLE");
        return true;
      },
    );
    assert.equal(rolledBack, true);
  } finally {
    agreementModel.getConnection = originalGetConnection;
    agreementModel.findActiveUserForUpdate = originalFindActiveUserForUpdate;
    agreementModel.findCasesByUserIdForUpdate = originalFindCasesByUserIdForUpdate;
  }
});
