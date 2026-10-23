import assert from "node:assert/strict";
import { test } from "node:test";

import "../../auth/setupEnv.js";

import basicDetailsModel from "./basicDetails.model.js";
import basicDetailsService from "./basicDetails.service.js";
import { validateBasicDetails } from "./basicDetails.validator.js";
import statusService from "../status/status.service.js";
import ApiError from "../../../utils/ApiError.js";

// ── Validation Tests ──

test("validateBasicDetails: accepts valid body and sets validatedBody", () => {
  const req = {
    body: {
      businessType: "Proprietorship Retail",
      shopAddress: "Shop 12, Ground Floor, Central Mall",
      city: "Mumbai",
      pincode: "400001",
    },
  };
  let nextCalled = false;
  let nextError = null;

  validateBasicDetails(req, {}, (err) => {
    nextCalled = true;
    nextError = err;
  });

  assert.equal(nextCalled, true);
  assert.equal(nextError, undefined);
  assert.deepEqual(req.validatedBody, {
    businessType: "Proprietorship Retail",
    shopAddress: "Shop 12, Ground Floor, Central Mall",
    city: "Mumbai",
    pincode: "400001",
  });
});

test("validateBasicDetails: accepts free-text business type of any valid category", () => {
  const categories = [
    "Kirana Store",
    "IT Services & Consulting",
    "Wholesale Electronics",
    "Agriculture / Farming",
    "Self-Employed Freelancer",
  ];

  for (const cat of categories) {
    const req = {
      body: {
        businessType: cat,
        shopAddress: "123 High Street",
        city: "Pune",
        pincode: "411001",
      },
    };
    let nextCalled = false;
    let nextError = null;

    validateBasicDetails(req, {}, (err) => {
      nextCalled = true;
      nextError = err;
    });

    assert.equal(nextCalled, true);
    assert.equal(nextError, undefined);
    assert.equal(req.validatedBody.businessType, cat);
  }
});

test("validateBasicDetails: rejects missing required fields", () => {
  const missingCases = [
    {},
    { shopAddress: "Addr", city: "City", pincode: "400001" }, // missing businessType
    { businessType: "Retail", city: "City", pincode: "400001" }, // missing shopAddress
    { businessType: "Retail", shopAddress: "Addr", pincode: "400001" }, // missing city
    { businessType: "Retail", shopAddress: "Addr", city: "City" }, // missing pincode
  ];

  for (const body of missingCases) {
    const req = { body };
    let nextError = null;
    validateBasicDetails(req, {}, (err) => {
      nextError = err;
    });
    assert.ok(nextError instanceof ApiError);
    assert.equal(nextError.statusCode, 400);
    assert.equal(nextError.code, "VALIDATION_ERROR");
  }
});

test("validateBasicDetails: rejects unexpected fields such as profile fields", () => {
  const unexpectedBodies = [
    {
      businessType: "Retail",
      shopAddress: "Addr",
      city: "City",
      pincode: "400001",
      name: "Shubham Diwkar", // Profile field
    },
    {
      businessType: "Retail",
      shopAddress: "Addr",
      city: "City",
      pincode: "400001",
      email: "shubham@gmail.com", // Profile field
    },
    {
      businessType: "Retail",
      shopAddress: "Addr",
      city: "City",
      pincode: "400001",
      mobile: "7738647711", // Profile field
    },
    {
      businessType: "Retail",
      shopAddress: "Addr",
      city: "City",
      pincode: "400001",
      userId: 42, // Spoofed user ID
    },
    {
      businessType: "Retail",
      shopAddress: "Addr",
      city: "City",
      pincode: "400001",
      shopname: "Shubham Store", // Unrelated user column
    },
  ];

  for (const body of unexpectedBodies) {
    const req = { body };
    let nextError = null;
    validateBasicDetails(req, {}, (err) => {
      nextError = err;
    });
    assert.ok(nextError instanceof ApiError);
    assert.equal(nextError.statusCode, 400);
    assert.match(nextError.message, /Unexpected request field/);
  }
});

test("validateBasicDetails: rejects invalid field types and excessive field lengths", () => {
  // Excessive lengths
  const longTypeReq = {
    body: {
      businessType: "A".repeat(101),
      shopAddress: "Valid Address",
      city: "Valid City",
      pincode: "400001",
    },
  };
  let err1;
  validateBasicDetails(longTypeReq, {}, (err) => { err1 = err; });
  assert.ok(err1 instanceof ApiError);
  assert.match(err1.message, /Business type must not exceed 100 characters/);

  const longAddrReq = {
    body: {
      businessType: "Retail",
      shopAddress: "B".repeat(256),
      city: "Valid City",
      pincode: "400001",
    },
  };
  let err2;
  validateBasicDetails(longAddrReq, {}, (err) => { err2 = err; });
  assert.ok(err2 instanceof ApiError);
  assert.match(err2.message, /Shop address must not exceed 255 characters/);

  const longCityReq = {
    body: {
      businessType: "Retail",
      shopAddress: "Valid Address",
      city: "C".repeat(101),
      pincode: "400001",
    },
  };
  let err3;
  validateBasicDetails(longCityReq, {}, (err) => { err3 = err; });
  assert.ok(err3 instanceof ApiError);
  assert.match(err3.message, /City must not exceed 100 characters/);

  // Invalid types
  const numberTypeReq = {
    body: {
      businessType: 12345,
      shopAddress: true,
      city: ["Mumbai"],
      pincode: 400001,
    },
  };
  let err4;
  validateBasicDetails(numberTypeReq, {}, (err) => { err4 = err; });
  assert.ok(err4 instanceof ApiError);
  assert.equal(err4.statusCode, 400);
});

test("validateBasicDetails: rejects empty or whitespace-only business type", () => {
  const req = {
    body: {
      businessType: "   ",
      shopAddress: "Valid Address",
      city: "Valid City",
      pincode: "400001",
    },
  };
  let err;
  validateBasicDetails(req, {}, (e) => { err = e; });
  assert.ok(err instanceof ApiError);
  assert.match(err.message, /Business type is required/);
});

test("validateBasicDetails: pincode validation preserves leading zeros and rejects non-strings", () => {
  // Valid pincode with leading zero
  const leadingZeroReq = {
    body: {
      businessType: "Retail",
      shopAddress: "Main Road",
      city: "Delhi",
      pincode: "012345",
    },
  };
  let nextCalled = false;
  validateBasicDetails(leadingZeroReq, {}, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.equal(leadingZeroReq.validatedBody.pincode, "012345");

  // Number type must be rejected to prevent unsafe numeric coercion
  const numberPincodeReq = {
    body: {
      businessType: "Retail",
      shopAddress: "Main Road",
      city: "Delhi",
      pincode: 400001,
    },
  };
  let numErr;
  validateBasicDetails(numberPincodeReq, {}, (e) => { numErr = e; });
  assert.ok(numErr instanceof ApiError);
  assert.match(numErr.message, /Pincode must be a string/);

  // 5 digits rejected
  const shortPincodeReq = {
    body: {
      businessType: "Retail",
      shopAddress: "Main Road",
      city: "Delhi",
      pincode: "12345",
    },
  };
  let shortErr;
  validateBasicDetails(shortPincodeReq, {}, (e) => { shortErr = e; });
  assert.ok(shortErr instanceof ApiError);
  assert.match(shortErr.message, /Invalid pincode/);

  // 7 digits rejected
  const longPincodeReq = {
    body: {
      businessType: "Retail",
      shopAddress: "Main Road",
      city: "Delhi",
      pincode: "1234567",
    },
  };
  let longErr;
  validateBasicDetails(longPincodeReq, {}, (e) => { longErr = e; });
  assert.ok(longErr instanceof ApiError);
  assert.match(longErr.message, /Invalid pincode/);
});

// ── Service & Transaction Tests ──

function createMockConnection() {
  const operations = [];
  return {
    operations,
    beginTransaction: async () => { operations.push("beginTransaction"); },
    commit: async () => { operations.push("commit"); },
    rollback: async () => { operations.push("rollback"); },
    release: () => { operations.push("release"); },
  };
}

test("basicDetailsService: creates a new draft KYC case and initializes 7 steps when no case exists", async () => {
  const mockConn = createMockConnection();
  const originalGetConn = basicDetailsModel.getConnection;
  const originalFindUser = basicDetailsModel.findUserById;
  const originalFindCase = basicDetailsModel.findCaseByUserId;
  const originalCreateCase = basicDetailsModel.createCase;
  const originalFindSteps = basicDetailsModel.findStepsByCaseId;
  const originalInsertStep = basicDetailsModel.insertStep;
  const originalUpdateUserAddr = basicDetailsModel.updateUserAddress;

  const insertedSteps = [];
  let createdCasePayload = null;
  let updatedAddressPayload = null;

  basicDetailsModel.getConnection = async () => mockConn;
  basicDetailsModel.findUserById = async (conn, id) => {
    assert.equal(id, "42");
    return { id: 42, name: "Original Name", email: "user@test.com", mobile: "+919876543210" };
  };
  basicDetailsModel.findCaseByUserId = async () => null; // No case exists yet
  basicDetailsModel.createCase = async (conn, payload) => {
    createdCasePayload = payload;
    return 101; // Created case ID
  };
  basicDetailsModel.findStepsByCaseId = async () => []; // No steps yet
  basicDetailsModel.insertStep = async (conn, step) => {
    insertedSteps.push(step);
  };
  basicDetailsModel.updateUserAddress = async (conn, userId, addr) => {
    updatedAddressPayload = { userId, ...addr };
  };

  statusService._cache.set("42", { hasCase: false, case: null });

  try {
    const result = await basicDetailsService.saveBasicDetails("42", {
      businessType: "Wholesale Trader",
      shopAddress: "Plot 5, Industrial Area",
      city: "Nagpur",
      pincode: "440001",
    });

    // Check response
    assert.equal(result.businessType, "Wholesale Trader");
    assert.equal(result.shopAddress, "Plot 5, Industrial Area");
    assert.equal(result.city, "Nagpur");
    assert.equal(result.pincode, "440001");
    assert.equal(result.caseStatus, "draft");
    assert.equal(result.currentStep, 1);

    // Check case creation
    assert.deepEqual(createdCasePayload, {
      userId: "42",
      businessType: "Wholesale Trader",
    });

    // Check 7 steps initialized
    assert.equal(insertedSteps.length, 7);
    assert.equal(insertedSteps[0].stepNumber, 1);
    assert.equal(insertedSteps[0].status, "completed");
    assert.ok(insertedSteps[0].completedAt instanceof Date);

    for (let i = 1; i < 7; i++) {
      assert.equal(insertedSteps[i].stepNumber, i + 1);
      assert.equal(insertedSteps[i].status, "pending");
      assert.equal(insertedSteps[i].completedAt, null);
    }

    // Check user address update
    assert.deepEqual(updatedAddressPayload, {
      userId: "42",
      shopAddress: "Plot 5, Industrial Area",
      city: "Nagpur",
      pincode: "440001",
    });

    // Check transaction flow: beginTransaction -> commit -> release
    assert.ok(mockConn.operations.includes("beginTransaction"));
    assert.ok(mockConn.operations.includes("commit"));
    assert.ok(mockConn.operations.includes("release"));
    assert.ok(!mockConn.operations.includes("rollback"));

    // Check cache invalidation for user 42
    assert.equal(statusService._cache.get("42"), undefined);
  } finally {
    basicDetailsModel.getConnection = originalGetConn;
    basicDetailsModel.findUserById = originalFindUser;
    basicDetailsModel.findCaseByUserId = originalFindCase;
    basicDetailsModel.createCase = originalCreateCase;
    basicDetailsModel.findStepsByCaseId = originalFindSteps;
    basicDetailsModel.insertStep = originalInsertStep;
    basicDetailsModel.updateUserAddress = originalUpdateUserAddr;
    statusService._cache.clear();
  }
});

test("basicDetailsService: updates existing draft case without duplicate case creation and preserves existing step progress", async () => {
  const mockConn = createMockConnection();
  const originalGetConn = basicDetailsModel.getConnection;
  const originalFindUser = basicDetailsModel.findUserById;
  const originalFindCase = basicDetailsModel.findCaseByUserId;
  const originalCreateCase = basicDetailsModel.createCase;
  const originalUpdateCase = basicDetailsModel.updateCaseBusinessType;
  const originalFindSteps = basicDetailsModel.findStepsByCaseId;
  const originalInsertStep = basicDetailsModel.insertStep;
  const originalUpdateStep = basicDetailsModel.updateStep;
  const originalUpdateUserAddr = basicDetailsModel.updateUserAddress;

  let createCaseCalled = false;
  let updateCaseCalledWith = null;
  const updatedSteps = [];
  const insertedSteps = [];

  basicDetailsModel.getConnection = async () => mockConn;
  basicDetailsModel.findUserById = async () => ({ id: 42, name: "Preserved User" });
  basicDetailsModel.findCaseByUserId = async () => ({
    id: 101,
    user_id: 42,
    business_type: "Old Business",
    status: "draft",
    current_step: 2,
  });
  basicDetailsModel.createCase = async () => {
    createCaseCalled = true;
  };
  basicDetailsModel.updateCaseBusinessType = async (conn, id, bType) => {
    updateCaseCalledWith = { id, bType };
  };
  basicDetailsModel.findStepsByCaseId = async () => [
    { step_number: 1, status: "completed", completed_at: new Date("2026-01-01T00:00:00Z") },
    { step_number: 2, status: "in_progress", completed_at: null },
    { step_number: 3, status: "pending", completed_at: null },
    { step_number: 4, status: "pending", completed_at: null },
    { step_number: 5, status: "pending", completed_at: null },
    { step_number: 6, status: "pending", completed_at: null },
    { step_number: 7, status: "pending", completed_at: null },
  ];
  basicDetailsModel.insertStep = async (conn, s) => { insertedSteps.push(s); };
  basicDetailsModel.updateStep = async (conn, s) => { updatedSteps.push(s); };
  basicDetailsModel.updateUserAddress = async () => {};

  try {
    const result = await basicDetailsService.saveBasicDetails("42", {
      businessType: "New Retail Shop",
      shopAddress: "New Shop Address",
      city: "Nashik",
      pincode: "422001",
    });

    assert.equal(createCaseCalled, false); // No duplicate case created
    assert.deepEqual(updateCaseCalledWith, { id: 101, bType: "New Retail Shop" });
    assert.equal(result.currentStep, 2); // Preserved current step
    assert.equal(insertedSteps.length, 0); // All 7 steps already existed, no duplicates inserted
    assert.equal(updatedSteps.length, 0); // Step 1 was already completed, preserved as is

    assert.ok(mockConn.operations.includes("commit"));
  } finally {
    basicDetailsModel.getConnection = originalGetConn;
    basicDetailsModel.findUserById = originalFindUser;
    basicDetailsModel.findCaseByUserId = originalFindCase;
    basicDetailsModel.createCase = originalCreateCase;
    basicDetailsModel.updateCaseBusinessType = originalUpdateCase;
    basicDetailsModel.findStepsByCaseId = originalFindSteps;
    basicDetailsModel.insertStep = originalInsertStep;
    basicDetailsModel.updateStep = originalUpdateStep;
    basicDetailsModel.updateUserAddress = originalUpdateUserAddr;
  }
});

test("basicDetailsService: rejects updates when case is not editable (submitted, under_review, approved, rejected)", async () => {
  const nonEditableStatuses = ["submitted", "under_review", "approved", "rejected"];

  for (const status of nonEditableStatuses) {
    const mockConn = createMockConnection();
    const originalGetConn = basicDetailsModel.getConnection;
    const originalFindUser = basicDetailsModel.findUserById;
    const originalFindCase = basicDetailsModel.findCaseByUserId;

    basicDetailsModel.getConnection = async () => mockConn;
    basicDetailsModel.findUserById = async () => ({ id: 42 });
    basicDetailsModel.findCaseByUserId = async () => ({
      id: 101,
      user_id: 42,
      status,
      current_step: 3,
    });

    try {
      await assert.rejects(
        async () => {
          await basicDetailsService.saveBasicDetails("42", {
            businessType: "Retail",
            shopAddress: "Address",
            city: "City",
            pincode: "400001",
          });
        },
        (err) => {
          assert.ok(err instanceof ApiError);
          assert.equal(err.statusCode, 400);
          assert.equal(err.code, "CASE_NOT_EDITABLE");
          return true;
        },
      );

      assert.ok(mockConn.operations.includes("rollback"));
      assert.ok(!mockConn.operations.includes("commit"));
    } finally {
      basicDetailsModel.getConnection = originalGetConn;
      basicDetailsModel.findUserById = originalFindUser;
      basicDetailsModel.findCaseByUserId = originalFindCase;
    }
  }
});

test("basicDetailsService: rolls back transaction on database error and does not invalidate cache", async () => {
  const mockConn = createMockConnection();
  const originalGetConn = basicDetailsModel.getConnection;
  const originalFindUser = basicDetailsModel.findUserById;

  basicDetailsModel.getConnection = async () => mockConn;
  basicDetailsModel.findUserById = async () => {
    throw new Error("DB connection timeout");
  };

  statusService._cache.set("42", { hasCase: true });

  try {
    await assert.rejects(
      async () => {
        await basicDetailsService.saveBasicDetails("42", {
          businessType: "Retail",
          shopAddress: "Address",
          city: "City",
          pincode: "400001",
        });
      },
      (err) => {
        assert.ok(err instanceof ApiError);
        assert.equal(err.statusCode, 503);
        assert.equal(err.code, "SERVICE_UNAVAILABLE");
        assert.ok(!err.message.includes("DB connection timeout")); // Does not expose internal DB details
        return true;
      },
    );

    assert.ok(mockConn.operations.includes("rollback"));
    assert.ok(!mockConn.operations.includes("commit"));

    // Cache must NOT be invalidated after a failed transaction
    assert.deepEqual(statusService._cache.get("42"), { hasCase: true });
  } finally {
    basicDetailsModel.getConnection = originalGetConn;
    basicDetailsModel.findUserById = originalFindUser;
    statusService._cache.clear();
  }
});

test("basicDetailsService: preserves profile name, email, and mobile untouched", async () => {
  const mockConn = createMockConnection();
  const originalGetConn = basicDetailsModel.getConnection;
  const originalFindUser = basicDetailsModel.findUserById;
  const originalFindCase = basicDetailsModel.findCaseByUserId;
  const originalCreateCase = basicDetailsModel.createCase;
  const originalFindSteps = basicDetailsModel.findStepsByCaseId;
  const originalInsertStep = basicDetailsModel.insertStep;
  const originalUpdateUserAddr = basicDetailsModel.updateUserAddress;

  let capturedAddressUpdate = null;

  basicDetailsModel.getConnection = async () => mockConn;
  basicDetailsModel.findUserById = async () => ({
    id: 42,
    name: "Immutable Name",
    email: "immutable@aqua.pay",
    mobile: "+919876543210",
  });
  basicDetailsModel.findCaseByUserId = async () => null;
  basicDetailsModel.createCase = async () => 101;
  basicDetailsModel.findStepsByCaseId = async () => [];
  basicDetailsModel.insertStep = async () => {};
  basicDetailsModel.updateUserAddress = async (conn, userId, fields) => {
    capturedAddressUpdate = fields;
  };

  try {
    await basicDetailsService.saveBasicDetails("42", {
      businessType: "Retail",
      shopAddress: "Shop Address",
      city: "City",
      pincode: "400001",
    });

    // Verify updateUserAddress only receives shopAddress, city, pincode
    assert.deepEqual(Object.keys(capturedAddressUpdate).sort(), ["city", "pincode", "shopAddress"]);
    assert.equal(capturedAddressUpdate.name, undefined);
    assert.equal(capturedAddressUpdate.email, undefined);
    assert.equal(capturedAddressUpdate.mobile, undefined);
  } finally {
    basicDetailsModel.getConnection = originalGetConn;
    basicDetailsModel.findUserById = originalFindUser;
    basicDetailsModel.findCaseByUserId = originalFindCase;
    basicDetailsModel.createCase = originalCreateCase;
    basicDetailsModel.findStepsByCaseId = originalFindSteps;
    basicDetailsModel.insertStep = originalInsertStep;
    basicDetailsModel.updateUserAddress = originalUpdateUserAddr;
  }
});

// ── Model Parameterized Query Tests ──

test("basicDetailsModel uses parameterized SQL queries", async () => {
  const captured = [];
  const fakeConnection = {
    execute: async (sql, params) => {
      captured.push({ sql, params });
      return [[]];
    },
  };

  await basicDetailsModel.findUserById(fakeConnection, 42);
  assert.match(captured[0].sql, /FROM users\s+WHERE id = \?/);
  assert.deepEqual(captured[0].params, [42]);

  await basicDetailsModel.findCaseByUserId(fakeConnection, 42);
  assert.match(captured[1].sql, /FROM kyc_cases\s+WHERE user_id = \?/);
  assert.deepEqual(captured[1].params, [42]);

  await basicDetailsModel.createCase(fakeConnection, { userId: 42, businessType: "Retail" });
  assert.match(captured[2].sql, /INSERT INTO kyc_cases/);
  assert.deepEqual(captured[2].params, [42, "Retail"]);

  await basicDetailsModel.updateCaseBusinessType(fakeConnection, 101, "Wholesale");
  assert.match(captured[3].sql, /UPDATE kyc_cases\s+SET business_type = \?/);
  assert.deepEqual(captured[3].params, ["Wholesale", 101]);

  await basicDetailsModel.updateUserAddress(fakeConnection, 42, {
    shopAddress: "123 Main St",
    city: "Delhi",
    pincode: "110001",
  });
  assert.match(captured[4].sql, /UPDATE users\s+SET address = \?,\s+city = \?,\s+pincode = \?/);
  assert.deepEqual(captured[4].params, ["123 Main St", "Delhi", "110001", 42]);
});

// ── Controller & Ownership Tests ──

test("basicDetailsController: derives userId from authenticated request and returns ApiResponse format", async () => {
  const { saveBasicDetails } = await import("./basicDetails.controller.js");
  const originalSave = basicDetailsService.saveBasicDetails;

  let serviceCalledWithUserId = null;
  let serviceCalledWithBody = null;

  basicDetailsService.saveBasicDetails = async (userId, body) => {
    serviceCalledWithUserId = userId;
    serviceCalledWithBody = body;
    return {
      businessType: body.businessType,
      shopAddress: body.shopAddress,
      city: body.city,
      pincode: body.pincode,
      caseStatus: "draft",
      currentStep: 1,
    };
  };

  const req = {
    user: { id: "88" }, // Authenticated user ID
    validatedBody: {
      businessType: "Retail",
      shopAddress: "Road 1",
      city: "Goa",
      pincode: "403001",
    },
    body: {
      userId: "999", // Attempted spoof in body - should be ignored!
    },
  };

  let responseStatus = null;
  let responseJson = null;

  const res = {
    status: (code) => {
      responseStatus = code;
      return res;
    },
    json: (payload) => {
      responseJson = payload;
      return res;
    },
  };

  try {
    await saveBasicDetails(req, res);

    assert.equal(responseStatus, 200);
    assert.equal(serviceCalledWithUserId, "88"); // Only authenticated ID is used
    assert.deepEqual(serviceCalledWithBody, req.validatedBody);

    assert.equal(responseJson.success, true);
    assert.equal(responseJson.statusCode, 200);
    assert.equal(responseJson.message, "Basic details saved successfully");
    assert.deepEqual(responseJson.data, {
      businessType: "Retail",
      shopAddress: "Road 1",
      city: "Goa",
      pincode: "403001",
      caseStatus: "draft",
      currentStep: 1,
    });
  } finally {
    basicDetailsService.saveBasicDetails = originalSave;
  }
});

test("basicDetailsController: rejects unauthenticated requests with 401 UNAUTHORIZED", async () => {
  const { saveBasicDetails } = await import("./basicDetails.controller.js");
  const req = {
    user: null, // Unauthenticated
    validatedBody: {
      businessType: "Retail",
      shopAddress: "Road 1",
      city: "Goa",
      pincode: "403001",
    },
  };

  let caughtErr = null;
  await new Promise((resolve) => {
    saveBasicDetails(req, {}, (err) => {
      caughtErr = err;
      resolve();
    });
  });

  assert.ok(caughtErr instanceof ApiError);
  assert.equal(caughtErr.statusCode, 401);
  assert.equal(caughtErr.code, "UNAUTHORIZED");
});
