import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeMobile,
  isValidMobile,
  isValidShopname,
  isValidAddress,
  isValidPincode,
  isValidPassword,
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

  // Number with 91 prefix without plus
  assert.equal(normalizeMobile("919876543210"), "+919876543210");
  assert.equal(isValidMobile("919876543210"), true);

  // Number with spaces and hyphens
  assert.equal(normalizeMobile(" 98765 43210 "), "+919876543210");
  assert.equal(normalizeMobile("+91 98765-43210"), "+919876543210");
  assert.equal(normalizeMobile("098765-43210"), "+919876543210");

  // Number starting with invalid digit (< 6)
  assert.equal(isValidMobile("5876543210"), false);
  assert.equal(isValidMobile("0000000000"), false);
  assert.equal(isValidMobile("1234567890"), false);

  // Invalid length
  assert.equal(isValidMobile("12345"), false);
  assert.equal(isValidMobile("987654321012345"), false);

  // Null, undefined, empty
  assert.equal(normalizeMobile(null), "");
  assert.equal(normalizeMobile(undefined), "");
  assert.equal(isValidMobile(null), false);
  assert.equal(isValidMobile(undefined), false);
  assert.equal(isValidMobile(""), false);
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

test("validationHelper: validates password length and UTF-8 byte boundary", () => {
  // Shorter than 8 characters
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("1234567"), false);
  assert.equal(isValidPassword(""), false);

  // Valid passwords (>= 8 characters and <= 72 bytes)
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword("Password@123"), true);
  assert.equal(isValidPassword("a".repeat(72)), true);

  // Exceeding 72 ASCII bytes (73 characters)
  assert.equal(isValidPassword("a".repeat(73)), false);

  // Multibyte characters within 72 bytes (each ₹ is 3 bytes: 24 * 3 = 72 bytes)
  assert.equal(isValidPassword("₹".repeat(24)), true);

  // Multibyte characters exceeding 72 bytes (25 * 3 = 75 bytes, even though character length is 25)
  assert.equal(isValidPassword("₹".repeat(25)), false);

  // 4-byte characters (emojis: 18 * 4 = 72 bytes)
  assert.equal(isValidPassword("🔑".repeat(18)), true);
  assert.equal(isValidPassword("🔑".repeat(19)), false);

  // Non-strings
  assert.equal(isValidPassword(null), false);
  assert.equal(isValidPassword(undefined), false);
  assert.equal(isValidPassword(12345678), false);
  assert.equal(isValidPassword({}), false);
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

test("user.validator: normalizes all Indian mobile formats to +91XXXXXXXXXX", () => {
  const formats = [
    "9876543210",
    "09876543210",
    "919876543210",
    "+919876543210",
    " 98765 43210 ",
  ];

  for (const mobileFormat of formats) {
    const { req, error } = runValidator({
      name: "John Doe",
      email: "john@example.com",
      mobile: mobileFormat,
      password: "Password@123",
      roleId: 2,
    });
    assert.equal(error, undefined);
    assert.equal(req.validatedBody.mobile, "+919876543210");
  }
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

test("user.validator: rejects invalid mobile numbers", () => {
  const invalidNumbers = [
    "5876543210", // starts with 5
    "12345",      // too short
    "abcdefghij", // non-numeric
    "0000000000", // invalid prefix
    "",
  ];

  for (const mobile of invalidNumbers) {
    const { error } = runValidator({
      name: "John Doe",
      email: "john@example.com",
      mobile,
      password: "Password@123",
      roleId: 2,
    });
    assert.ok(error);
    assert.equal(error.statusCode, 400);
  }
});

test("user.validator: validates password bounds including multibyte characters", () => {
  // Shorter than 8 characters
  const shortResult = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "short",
    roleId: 2,
  });
  assert.ok(shortResult.error);
  assert.equal(shortResult.error.statusCode, 400);
  assert.ok(shortResult.error.errors.includes("Password must contain at least 8 characters"));

  // Exceeding 72 UTF-8 bytes (ASCII 73 chars)
  const longResult = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "x".repeat(73),
    roleId: 2,
  });
  assert.ok(longResult.error);
  assert.equal(longResult.error.statusCode, 400);
  assert.ok(longResult.error.errors.includes("Password must not exceed 72 bytes"));

  // Multibyte exceeding 72 UTF-8 bytes (25 * 3 = 75 bytes)
  const multibyteLong = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "₹".repeat(25),
    roleId: 2,
  });
  assert.ok(multibyteLong.error);
  assert.equal(multibyteLong.error.statusCode, 400);
  assert.ok(multibyteLong.error.errors.includes("Password must not exceed 72 bytes"));

  // Valid multibyte password within 72 bytes
  const multibyteValid = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "Pass🔑word123",
    roleId: 2,
  });
  assert.equal(multibyteValid.error, undefined);
  assert.equal(multibyteValid.req.validatedBody.password, "Pass🔑word123");
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
      assert.equal(businessType, "Private Limited Company");
      assert.equal(actorId, 5);
      kycCaseInitialized = true;
      return { caseId: 1, status: "pending", stepsCompleted: 0 };
    };

    userModel.findUserSafeById = async (userId) => ({
      id: userId,
      name: "Ramesh Retailer",
      email: "ramesh@example.com",
      role_id: 8,
      role_slug: "RT",
      kyc: {
        status: "pending",
        steps_completed: 0,
        business_type: "Private Limited Company",
      },
    });

    const result = await userService.createUser({
      actorId: 5,
      name: "Ramesh Retailer",
      email: "ramesh@example.com",
      mobile: "9876543210",
      password: "Password@123",
      roleId: 8,
      businessType: "Private Limited Company",
    });

    assert.equal(kycCaseInitialized, true);
    assert.equal(result.id, 99);

    assert.deepEqual(result.kyc, {
      status: "pending",
      steps_completed: 0,
      business_type: "Private Limited Company",
    });
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

test("user.service: normalizes mobile number across formats before duplicate check and insertion", async () => {
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

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    });

    userModel.findUserForAuth = async () => ({
      id: 1,
      role_id: 1,
      role_name: "Admin",
      company_id: 1,
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 7,
      name: "Distributor",
      slug: "DT",
    });

    authorizationService.canCreateRole = async () => true;

    const formats = ["9876543210", "09876543210", "919876543210", "+919876543210"];

    for (const rawMobile of formats) {
      let duplicateCheckMobile = null;
      let insertedMobile = null;

      userModel.checkDuplicateUser = async ({ mobile }) => {
        duplicateCheckMobile = mobile;
        return null;
      };

      userModel.insertUser = async ({ mobile }) => {
        insertedMobile = mobile;
        return 101;
      };

      userModel.initKycCaseForUser = async () => ({});
      userModel.findUserSafeById = async (userId) => ({ id: userId, mobile: insertedMobile });

      await userService.createUser({
        actorId: 1,
        name: "Test Distributor",
        email: "dist@example.com",
        mobile: rawMobile,
        password: "Password@123",
        roleId: 7,
      });

      assert.equal(duplicateCheckMobile, "+919876543210");
      assert.equal(insertedMobile, "+919876543210");
    }
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

test("user.service: detects duplicate mobile across different formats", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (await import("../authorization/authorization.service.js")).default;
  const pool = (await import("../../config/db.js")).default;

  const originalGetConnection = pool.getConnection;
  const originalFindUserForAuth = userModel.findUserForAuth;
  const originalFindRoleByIdOrName = userModel.findRoleByIdOrName;
  const originalCanCreateRole = authorizationService.canCreateRole;
  const originalCheckDuplicateUser = userModel.checkDuplicateUser;

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    });

    userModel.findUserForAuth = async () => ({
      id: 1,
      role_id: 1,
      role_name: "Admin",
      company_id: 1,
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 7,
      name: "Distributor",
      slug: "DT",
    });

    authorizationService.canCreateRole = async () => true;

    // Simulate existing user with canonical +919876543210
    userModel.checkDuplicateUser = async ({ mobile }) => {
      if (mobile === "+919876543210") {
        return { id: 50, email: "existing@example.com", mobile: "+919876543210" };
      }
      return null;
    };

    // Attempting to create with any representation should hit duplicate check
    const rawFormats = ["9876543210", "09876543210", "919876543210", "+919876543210"];

    for (const rawMobile of rawFormats) {
      await assert.rejects(
        userService.createUser({
          actorId: 1,
          name: "Test User",
          email: "unique@example.com",
          mobile: rawMobile,
          password: "Password@123",
          roleId: 7,
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "DUPLICATE_ENTRY");
          assert.equal(error.message, "Mobile number already exists");
          return true;
        },
      );
    }
  } finally {
    pool.getConnection = originalGetConnection;
    userModel.findUserForAuth = originalFindUserForAuth;
    userModel.findRoleByIdOrName = originalFindRoleByIdOrName;
    authorizationService.canCreateRole = originalCanCreateRole;
    userModel.checkDuplicateUser = originalCheckDuplicateUser;
  }
});

test("user.service: validates password and uses configured bcrypt salt rounds before hashing", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (await import("../authorization/authorization.service.js")).default;
  const pool = (await import("../../config/db.js")).default;
  const bcrypt = (await import("bcryptjs")).default;
  const { getAuthConfig } = await import("../../config/auth.js");

  const originalGetConnection = pool.getConnection;
  const originalFindUserForAuth = userModel.findUserForAuth;
  const originalFindRoleByIdOrName = userModel.findRoleByIdOrName;
  const originalCanCreateRole = authorizationService.canCreateRole;
  const originalCheckDuplicateUser = userModel.checkDuplicateUser;
  const originalHash = bcrypt.hash;

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
    });

    userModel.findUserForAuth = async () => ({
      id: 1,
      role_id: 1,
      role_name: "Admin",
      company_id: 1,
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 7,
      name: "Distributor",
      slug: "DT",
    });

    authorizationService.canCreateRole = async () => true;
    userModel.checkDuplicateUser = async () => null;

    let hashCalled = false;
    let usedSaltRounds = null;
    bcrypt.hash = async (password, rounds) => {
      hashCalled = true;
      usedSaltRounds = rounds;
      return "mocked-hash";
    };

    // 1. Password shorter than 8 characters rejected before hashing
    await assert.rejects(
      userService.createUser({
        actorId: 1,
        name: "Test User",
        email: "user@example.com",
        mobile: "9876543210",
        password: "short",
        roleId: 7,
      }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, "Password must contain at least 8 characters");
        return true;
      },
    );
    assert.equal(hashCalled, false);

    // 2. Password exceeding 72 UTF-8 bytes rejected before hashing
    await assert.rejects(
      userService.createUser({
        actorId: 1,
        name: "Test User",
        email: "user@example.com",
        mobile: "9876543210",
        password: "x".repeat(73),
        roleId: 7,
      }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, "Password must not exceed 72 bytes");
        return true;
      },
    );
    assert.equal(hashCalled, false);

    // 3. Multibyte password exceeding 72 bytes rejected before hashing
    await assert.rejects(
      userService.createUser({
        actorId: 1,
        name: "Test User",
        email: "user@example.com",
        mobile: "9876543210",
        password: "₹".repeat(25),
        roleId: 7,
      }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, "Password must not exceed 72 bytes");
        return true;
      },
    );
    assert.equal(hashCalled, false);

    // 4. Valid password hashes with configured bcryptSaltRounds
    userModel.insertUser = async () => 200;
    userModel.initKycCaseForUser = async () => ({});
    userModel.findUserSafeById = async (id) => ({ id });

    await userService.createUser({
      actorId: 1,
      name: "Test User",
      email: "user@example.com",
      mobile: "9876543210",
      password: "ValidPassword@123",
      roleId: 7,
    });

    assert.equal(hashCalled, true);
    assert.equal(usedSaltRounds, getAuthConfig().bcryptSaltRounds);
  } finally {
    pool.getConnection = originalGetConnection;
    userModel.findUserForAuth = originalFindUserForAuth;
    userModel.findRoleByIdOrName = originalFindRoleByIdOrName;
    authorizationService.canCreateRole = originalCanCreateRole;
    userModel.checkDuplicateUser = originalCheckDuplicateUser;
    bcrypt.hash = originalHash;
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
    kyc_steps_completed: 3,
    kyc_business_type: "Retail Store",
  };

  const formattedWithKyc = formatUserRow(rowWithKyc);

  assert.equal(formattedWithKyc.id, 10);
  assert.equal(formattedWithKyc.kyc_case_id, undefined);
  assert.equal(formattedWithKyc.kyc_status, undefined);
  assert.equal(formattedWithKyc.kyc_steps_completed, undefined);
  assert.equal(formattedWithKyc.kyc_business_type, undefined);

  assert.deepEqual(formattedWithKyc.kyc, {
    status: "under_review",
    steps_completed: 3,
    business_type: "Retail Store",
  });

  const rowWithoutKyc = {
    id: 1,
    name: "Admin User",
    email: "admin@example.com",
    kyc_case_id: null,
    kyc_status: null,
    kyc_steps_completed: null,
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

test("get-user service: rejects invalid KYC status without querying users", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (await import("./get-user/get-user.service.js")).default;

  const originalFindActorRole = getUserModel.findActorRole;
  const originalFindAllUsers = getUserModel.findAllUsers;
  const originalFindChildrenByParentId = getUserModel.findChildrenByParentId;

  try {
    let modelCalled = false;

    getUserModel.findActorRole = async (actorId) => ({
      id: actorId,
      role_id: 1,
      role_slug: "AD",
    });

    getUserModel.findAllUsers = async () => {
      modelCalled = true;
      return [];
    };

    getUserModel.findChildrenByParentId = async () => {
      modelCalled = true;
      return [];
    };

    await assert.rejects(
      getUserService.getUsers(1, { kycStatus: "invalid" }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.equal(error.message, "Invalid KYC status");
        return true;
      },
    );

    assert.equal(modelCalled, false);
  } finally {
    getUserModel.findActorRole = originalFindActorRole;
    getUserModel.findAllUsers = originalFindAllUsers;
    getUserModel.findChildrenByParentId = originalFindChildrenByParentId;
  }
});
