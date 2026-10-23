import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeMobile,
  isValidMobile,
  isValidShopname,
  isValidAddress,
  isValidPincode,
} from "../../utils/validationHelper.js";
import { validateCreateUser } from "./user.validator.js";

function runValidator(body) {
  const req = { body };
  let error = null;
  validateCreateUser(req, {}, (err) => {
    error = err;
  });
  return { req, error };
}

test("validationHelper: normalizes mobile and validates Indian format", () => {
  // Normal 10-digit number
  assert.equal(normalizeMobile("9876543210"), "+919876543210");
  assert.equal(isValidMobile("9876543210"), true);

  // Number with +91
  assert.equal(normalizeMobile("+919876543210"), "+919876543210");
  assert.equal(isValidMobile("+919876543210"), true);

  // Number with leading 0
  assert.equal(normalizeMobile("09876543210"), "+919876543210");
  assert.equal(isValidMobile("09876543210"), true);

  // Number starting with invalid digit (< 6)
  assert.equal(isValidMobile("5876543210"), false);
  assert.equal(isValidMobile("0000000000"), false);

  // Invalid length
  assert.equal(isValidMobile("12345"), false);
});

test("validationHelper: validates shopname, address, and pincode", () => {
  assert.equal(isValidShopname("Aqua Kirana Store"), true);
  assert.equal(isValidShopname("a".repeat(151)), false);

  assert.equal(isValidAddress("123, MG Road, Sector 4"), true);
  assert.equal(isValidAddress("a".repeat(256)), false);

  assert.equal(isValidPincode("110001"), true);
  assert.equal(isValidPincode("010001"), false); // Pincodes don't start with 0
  assert.equal(isValidPincode("12345"), false); // 5 digits
  assert.equal(isValidPincode("1234567"), false); // 7 digits
});

test("user.validator: validates user creation input and sets validatedBody", () => {
  const validBody = {
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    shopname: "John Mart",
    address: "MG Road",
    state: "Maharashtra",
    city: "Mumbai",
    pincode: "400001",
    password: "Password@123",
    roleId: "2",
    businessType: "Grocery Store",
  };

  const { req, error } = runValidator(validBody);
  assert.equal(error, undefined);
  assert.equal(req.validatedBody.name, "John Doe");
  assert.equal(req.validatedBody.email, "john@example.com");
  assert.equal(req.validatedBody.mobile, "+919876543210");
  assert.equal(req.validatedBody.shopname, "John Mart");
  assert.equal(req.validatedBody.roleId, 2); // Correctly parsed numeric string to Number
  assert.equal(req.validatedBody.businessType, "Grocery Store");
});

test("user.validator: rejects invalid input", () => {
  const invalidBody = {
    name: "J", // Too short
    email: "not-an-email",
    mobile: "123",
    password: "short",
    roleId: -1,
    businessType: "a".repeat(101), // Exceeds 100 chars
  };

  const { error } = runValidator(invalidBody);
  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("get-user service: admin gets all users, non-admin gets only created users", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (await import("./get-user/get-user.service.js")).default;

  const originalFindActorRole = getUserModel.findActorRole;
  const originalFindAllUsers = getUserModel.findAllUsers;
  const originalFindChildrenByParentId = getUserModel.findChildrenByParentId;
  const originalFindUserById = getUserModel.findUserById;
  const originalFindChildByIdAndParentId = getUserModel.findChildByIdAndParentId;

  try {
    let called = "";

    getUserModel.findActorRole = async (actorId) => {
      if (actorId === 1) return { id: 1, role_id: 1, role_slug: "AD" }; // Admin
      return { id: 5, role_id: 7, role_slug: "DT" }; // Distributor
    };

    getUserModel.findAllUsers = async () => {
      called = "findAllUsers";
      return [{ id: 10, name: "User 10" }, { id: 20, name: "User 20" }];
    };

    getUserModel.findChildrenByParentId = async (parentId) => {
      called = `findChildren_${parentId}`;
      return [{ id: 20, name: "User 20", parent_id: parentId }];
    };

    getUserModel.findUserById = async (id) => {
      called = `findUserById_${id}`;
      return { id, name: `User ${id}` };
    };

    getUserModel.findChildByIdAndParentId = async (childId, parentId) => {
      called = `findChild_${childId}_parent_${parentId}`;
      return { id: childId, parent_id: parentId };
    };

    // 1. Admin gets all users
    const adminUsers = await getUserService.getUsers(1);
    assert.equal(called, "findAllUsers");
    assert.equal(adminUsers.length, 2);

    // 2. Non-admin gets only their children
    const nonAdminUsers = await getUserService.getUsers(5);
    assert.equal(called, "findChildren_5");
    assert.equal(nonAdminUsers.length, 1);

    // 3. Admin gets any user by ID
    const userForAdmin = await getUserService.getUserById(1, 99);
    assert.equal(called, "findUserById_99");
    assert.equal(userForAdmin.id, 99);

    // 4. Non-admin gets child user by ID
    const userForNonAdmin = await getUserService.getUserById(5, 20);
    assert.equal(called, "findChild_20_parent_5");
    assert.equal(userForNonAdmin.id, 20);
  } finally {
    getUserModel.findActorRole = originalFindActorRole;
    getUserModel.findAllUsers = originalFindAllUsers;
    getUserModel.findChildrenByParentId = originalFindChildrenByParentId;
    getUserModel.findUserById = originalFindUserById;
    getUserModel.findChildByIdAndParentId = originalFindChildByIdAndParentId;
  }
});

test("user.service: createUser initializes KYC case and returns user with KYC state", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (await import("../authorization/authorization.service.js")).default;
  const pool = (await import("../../config/db.js")).default;

  const originalGetConnection = pool.getConnection;
  const originalFindUserForAuth = userModel.findUserForAuth;
  const originalFindRoleByIdOrName = userModel.findRoleByIdOrName;
  const originalCanCreateRole = authorizationService.canCreateRole;
  const originalCheckDuplicateUser = userModel.checkDuplicateUser;
  const originalInsertUser = userModel.insertUser;
  const originalInitKycCaseForUser = userModel.initKycCaseForUser;
  const originalFindUserSafeById = userModel.findUserSafeById;

  let kycCaseInitialized = false;

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => { },
      commit: async () => { },
      rollback: async () => { },
      release: () => { },
    });

    userModel.findUserForAuth = async () => ({
      id: 5,
      role_id: 7,
      role_name: "Distributor",
      company_id: 1,
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 8,
      name: "Retailer",
      slug: "RT",
    });

    authorizationService.canCreateRole = async () => true;
    userModel.checkDuplicateUser = async () => null;
    userModel.insertUser = async () => 99;

    userModel.initKycCaseForUser = async ({ userId, businessType, actorId }) => {
      assert.equal(userId, 99);
      assert.equal(businessType, "Grocery");
      assert.equal(actorId, 5);
      kycCaseInitialized = true;
      return { caseId: 1, status: "draft", currentStep: 1 };
    };

    userModel.findUserSafeById = async (userId) => ({
      id: userId,
      name: "Ramesh Retailer",
      email: "ramesh@example.com",
      role_id: 8,
      role_slug: "RT",
      kyc: {
        case_id: 1,
        status: "draft",
        current_step: 1,
        business_type: "Grocery",
      },
    });

    const result = await userService.createUser({
      actorId: 5,
      name: "Ramesh Retailer",
      email: "ramesh@example.com",
      mobile: "9876543210",
      password: "Password@123",
      roleId: 8,
      businessType: "Grocery",
    });

    assert.equal(kycCaseInitialized, true);
    assert.equal(result.id, 99);
    assert.ok(result.kyc);
    assert.equal(result.kyc.case_id, 1);
    assert.equal(result.kyc.status, "draft");
    assert.equal(result.kyc.current_step, 1);
  } finally {
    pool.getConnection = originalGetConnection;
    userModel.findUserForAuth = originalFindUserForAuth;
    userModel.findRoleByIdOrName = originalFindRoleByIdOrName;
    authorizationService.canCreateRole = originalCanCreateRole;
    userModel.checkDuplicateUser = originalCheckDuplicateUser;
    userModel.insertUser = originalInsertUser;
    userModel.initKycCaseForUser = originalInitKycCaseForUser;
    userModel.findUserSafeById = originalFindUserSafeById;
  }
});

test("get-user model: formatUserRow correctly formats KYC details", async () => {
  const { formatUserRow } = await import("./get-user/get-user.model.js");

  const rowWithKyc = {
    id: 10,
    name: "Test User",
    email: "test@example.com",
    kyc_case_id: 42,
    kyc_status: "under_review",
    kyc_current_step: 3,
    kyc_business_type: "Retail Store",
    kyc_submitted_at: "2026-10-23T10:00:00Z",
    kyc_reviewed_at: null,
    kyc_rejection_reason: null,
  };

  const formattedWithKyc = formatUserRow(rowWithKyc);
  assert.equal(formattedWithKyc.id, 10);
  assert.equal(formattedWithKyc.kyc_case_id, undefined);
  assert.equal(formattedWithKyc.kyc_status, undefined);
  assert.ok(formattedWithKyc.kyc);
  assert.equal(formattedWithKyc.kyc.case_id, 42);
  assert.equal(formattedWithKyc.kyc.status, "under_review");
  assert.equal(formattedWithKyc.kyc.current_step, 3);
  assert.equal(formattedWithKyc.kyc.business_type, "Retail Store");
  assert.equal(formattedWithKyc.kyc.submitted_at, "2026-10-23T10:00:00Z");

  const rowWithoutKyc = {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    kyc_case_id: null,
    kyc_status: null,
    kyc_current_step: null,
    kyc_business_type: null,
  };

  const formattedWithoutKyc = formatUserRow(rowWithoutKyc);
  assert.equal(formattedWithoutKyc.id, 1);
  assert.equal(formattedWithoutKyc.kyc, null);
});

test("get-user service: passes kycStatus filter to model", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (await import("./get-user/get-user.service.js")).default;

  const originalFindActorRole = getUserModel.findActorRole;
  const originalFindAllUsers = getUserModel.findAllUsers;
  const originalFindChildrenByParentId = getUserModel.findChildrenByParentId;

  try {
    let capturedFilter = null;

    getUserModel.findActorRole = async (actorId) => {
      if (actorId === 1) return { id: 1, role_id: 1, role_slug: "AD" };
      return { id: 5, role_id: 7, role_slug: "DT" };
    };

    getUserModel.findAllUsers = async (options) => {
      capturedFilter = options;
      return [{ id: 10, name: "User 10" }];
    };

    getUserModel.findChildrenByParentId = async (parentId, options) => {
      capturedFilter = options;
      return [{ id: 20, name: "User 20" }];
    };

    await getUserService.getUsers(1, { kycStatus: "under_review" });
    assert.deepEqual(capturedFilter, { kycStatus: "under_review" });

    await getUserService.getUsers(5, { kycStatus: "approved" });
    assert.deepEqual(capturedFilter, { kycStatus: "approved" });
  } finally {
    getUserModel.findActorRole = originalFindActorRole;
    getUserModel.findAllUsers = originalFindAllUsers;
    getUserModel.findChildrenByParentId = originalFindChildrenByParentId;
  }
});


