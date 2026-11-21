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
  assert.equal(normalizeMobile("9876543210"), "+919876543210");
  assert.equal(isValidMobile("9876543210"), true);
  assert.equal(normalizeMobile("+919876543210"), "+919876543210");
  assert.equal(isValidMobile("+919876543210"), true);
  assert.equal(normalizeMobile("09876543210"), "+919876543210");
  assert.equal(isValidMobile("09876543210"), true);
  assert.equal(normalizeMobile("919876543210"), "+919876543210");
  assert.equal(isValidMobile("919876543210"), true);
  assert.equal(normalizeMobile(" 98765 43210 "), "+919876543210");
  assert.equal(normalizeMobile("+91 98765-43210"), "+919876543210");
  assert.equal(normalizeMobile("098765-43210"), "+919876543210");
  assert.equal(isValidMobile("5876543210"), false);
  assert.equal(isValidMobile("0000000000"), false);
  assert.equal(isValidMobile("1234567890"), false);
  assert.equal(isValidMobile("12345"), false);
  assert.equal(isValidMobile("987654321012345"), false);
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
  assert.equal(isValidPincode("010001"), false);
  assert.equal(isValidPincode("12345"), false);
  assert.equal(isValidPincode("1234567"), false);
});

test("validationHelper: validates password length and UTF-8 byte boundary", () => {
  assert.equal(isValidPassword("short"), false);
  assert.equal(isValidPassword("1234567"), false);
  assert.equal(isValidPassword(""), false);
  assert.equal(isValidPassword("12345678"), true);
  assert.equal(isValidPassword("Password@123"), true);
  assert.equal(isValidPassword("a".repeat(72)), true);
  assert.equal(isValidPassword("a".repeat(73)), false);
  assert.equal(isValidPassword("₹".repeat(24)), true);
  assert.equal(isValidPassword("₹".repeat(25)), false);
  assert.equal(isValidPassword("🔑".repeat(18)), true);
  assert.equal(isValidPassword("🔑".repeat(19)), false);
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
  };

  const { req, error } = runValidator(validBody);
  assert.equal(error, undefined);
  assert.equal(req.validatedBody.name, "John Doe");
  assert.equal(req.validatedBody.email, "john@example.com");
  assert.equal(req.validatedBody.mobile, "+919876543210");
  assert.equal(req.validatedBody.shopname, "John Mart");
  assert.equal(req.validatedBody.roleId, 2);
  assert.equal("businessType" in req.validatedBody, false);
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
    name: "J",
    email: "not-an-email",
    mobile: "123",
    password: "short",
    roleId: -1,
  };

  const { error } = runValidator(invalidBody);
  assert.ok(error);
  assert.equal(error.statusCode, 400);
});

test("user.validator: rejects invalid mobile numbers", () => {
  const invalidNumbers = [
    "5876543210",
    "12345",
    "abcdefghij",
    "0000000000",
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
  const shortResult = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "short",
    roleId: 2,
  });

  assert.ok(shortResult.error);
  assert.equal(shortResult.error.statusCode, 400);
  assert.ok(
    shortResult.error.errors.includes(
      "Password must contain at least 8 characters",
    ),
  );

  const longResult = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "x".repeat(73),
    roleId: 2,
  });

  assert.ok(longResult.error);
  assert.equal(longResult.error.statusCode, 400);
  assert.ok(
    longResult.error.errors.includes("Password must not exceed 72 bytes"),
  );

  const multibyteLong = runValidator({
    name: "John Doe",
    email: "john@example.com",
    mobile: "9876543210",
    password: "₹".repeat(25),
    roleId: 2,
  });

  assert.ok(multibyteLong.error);
  assert.equal(multibyteLong.error.statusCode, 400);
  assert.ok(
    multibyteLong.error.errors.includes("Password must not exceed 72 bytes"),
  );

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
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;

  const originals = {
    findActorRole: getUserModel.findActorRole,
    findAllUsers: getUserModel.findAllUsers,
    findChildrenByParentId: getUserModel.findChildrenByParentId,
    findUserById: getUserModel.findUserById,
    findChildByIdAndParentId: getUserModel.findChildByIdAndParentId,
    findDescendantUserById: getUserModel.findDescendantUserById,
    canCreateRole: authorizationService.canCreateRole,
  };

  try {
    let called = "";

    getUserModel.findActorRole = async (actorId) => {
      if (actorId === 1) {
        return { id: 1, role_id: 1, role_slug: "AD" };
      }
      return { id: 5, role_id: 7, role_slug: "DT" };
    };

    getUserModel.findAllUsers = async () => {
      called = "findAllUsers";
      return [
        { id: 10, name: "User 10" },
        { id: 20, name: "User 20" },
      ];
    };

    getUserModel.findChildrenByParentId = async (parentId) => {
      called = `findChildren_${parentId}`;
      return [{ id: 20, name: "User 20", parent_id: parentId }];
    };

    getUserModel.findUserById = async (id) => {
      called = `findUserById_${id}`;
      return { id, name: `User ${id}` };
    };

    getUserModel.findDescendantUserById = async (childId, parentId) => {
      called = `findDescendant_${childId}_under_${parentId}`;
      return { id: childId, parent_id: parentId };
    };

    authorizationService.canCreateRole = async () => true;

    const adminUsers = await getUserService.getUsers(1);
    assert.equal(called, "findAllUsers");
    assert.equal(adminUsers.length, 2);

    const nonAdminUsers = await getUserService.getUsers(5);
    assert.equal(called, "findChildren_5");
    assert.equal(nonAdminUsers.length, 1);

    const userForAdmin = await getUserService.getUserById(1, 99);
    assert.equal(called, "findUserById_99");
    assert.equal(userForAdmin.id, 99);

    const userForNonAdmin = await getUserService.getUserById(5, 20);
    assert.equal(called, "findDescendant_20_under_5");
    assert.equal(userForNonAdmin.id, 20);
  } finally {
    getUserModel.findActorRole = originals.findActorRole;
    getUserModel.findAllUsers = originals.findAllUsers;
    getUserModel.findChildrenByParentId = originals.findChildrenByParentId;
    getUserModel.findUserById = originals.findUserById;
    getUserModel.findChildByIdAndParentId =
      originals.findChildByIdAndParentId;
    getUserModel.findDescendantUserById =
      originals.findDescendantUserById;
    authorizationService.canCreateRole = originals.canCreateRole;
  }
});

test("get-user service authorizes selected roles server-side and scopes records to descendant users", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (await import("./get-user/get-user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;

  const originals = {
    findActorRole: getUserModel.findActorRole,
    findUsersInDescendantScope: getUserModel.findUsersInDescendantScope,
    canCreateRole: authorizationService.canCreateRole,
  };

  try {
    getUserModel.findActorRole = async () => ({
      id: 10,
      role_id: 3,
      role_slug: "NSM",
    });

    authorizationService.canCreateRole = async (actorRoleId, roleId) =>
      actorRoleId === 3 && roleId === 8;

    getUserModel.findUsersInDescendantScope = async (
      actorId,
      roleId,
      options,
    ) => {
      assert.equal(actorId, 10);
      assert.equal(roleId, 8);
      assert.equal(options.roleId, 8);
      return [{ id: 99, role_id: 8 }];
    };

    assert.deepEqual(
      await getUserService.getUsers(10, { roleId: "8" }),
      [{ id: 99, role_id: 8 }],
    );

    await assert.rejects(
      getUserService.getUsers(10, { roleId: "2" }),
      (error) => error.statusCode === 403,
    );
  } finally {
    getUserModel.findActorRole = originals.findActorRole;
    getUserModel.findUsersInDescendantScope =
      originals.findUsersInDescendantScope;
    authorizationService.canCreateRole = originals.canCreateRole;
  }
});

test("admin password reset is restricted to Admin and returns no password material", async () => {
  const model = (
    await import("./reset-password/reset-password.model.js")
  ).default;
  const service = (
    await import("./reset-password/reset-password.service.js")
  ).default;
  const bcrypt = (await import("bcryptjs")).default;

  const originals = {
    getConnection: model.getConnection,
    findActiveUserForUpdate: model.findActiveUserForUpdate,
    findTargetForUpdate: model.findTargetForUpdate,
    isDescendant: model.isDescendant,
    updatePasswordHash: model.updatePasswordHash,
    hash: bcrypt.hash,
  };

  let actorRoleId = 2;
  let writtenHash;
  const calls = [];

  try {
    model.getConnection = async () => ({
      beginTransaction: async () => calls.push("begin"),
      commit: async () => calls.push("commit"),
      rollback: async () => calls.push("rollback"),
      release: () => calls.push("release"),
    });

    model.findActiveUserForUpdate = async (_connection, actorId) => ({
      id: actorId,
      role_id: actorRoleId,
      status: "active",
    });

    model.findTargetForUpdate = async (_connection, targetId) => ({
      id: targetId,
      role_id: 8,
      parent_id: 20,
      status: "active",
    });

    model.isDescendant = async () => true;

    bcrypt.hash = async (password) => {
      assert.equal(password, "NewSecurePassword123");
      return "bcrypt-hash-only";
    };

    model.updatePasswordHash = async (_connection, targetId, hash) => {
      writtenHash = hash;
      assert.equal(targetId, 52);
      return true;
    };

    await assert.rejects(
      service.resetSubordinatePassword({
        actorId: 20,
        targetUserId: 52,
        newPassword: "NewSecurePassword123",
      }),
      (error) =>
        error.statusCode === 403 && error.code === "FORBIDDEN",
    );

    assert.equal(calls.includes("commit"), false);

    actorRoleId = 1;

    const result = await service.resetSubordinatePassword({
      actorId: 1,
      targetUserId: 52,
      newPassword: "NewSecurePassword123",
    });

    assert.deepEqual(result, {
      message: "User password reset successfully",
    });

    assert.equal(writtenHash, "bcrypt-hash-only");
    assert.equal(
      JSON.stringify(result).includes("NewSecurePassword123"),
      false,
    );
    assert.equal(
      JSON.stringify(result).includes("bcrypt-hash-only"),
      false,
    );
    assert.equal(calls.at(-1), "release");
  } finally {
    model.getConnection = originals.getConnection;
    model.findActiveUserForUpdate = originals.findActiveUserForUpdate;
    model.findTargetForUpdate = originals.findTargetForUpdate;
    model.isDescendant = originals.isDescendant;
    model.updatePasswordHash = originals.updatePasswordHash;
    bcrypt.hash = originals.hash;
  }
});

test("user.model: default scheme lookup uses the supplied connection", async () => {
  const userModel = (await import("./user.model.js")).default;

  const connection = {
    execute: async (sql) => {
      assert.match(sql, /FROM schemes/);
      assert.match(sql, /is_default = 1/);
      assert.match(sql, /status = 1/);
      return [[{ id: 12, name: "Default Scheme" }]];
    },
  };

  const result = await userModel.findActiveDefaultScheme(connection);

  assert.deepEqual(result, {
    id: 12,
    name: "Default Scheme",
  });
});

test("user.service: createUser assigns Default Scheme, records history, and initializes KYC", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
    findActiveDefaultScheme: userModel.findActiveDefaultScheme,
    insertUser: userModel.insertUser,
    insertSchemeAssignmentHistory: userModel.insertSchemeAssignmentHistory,
    initKycCaseForUser: userModel.initKycCaseForUser,
    findUserSafeById: userModel.findUserSafeById,
  };

  const events = [];

  const connection = {
    beginTransaction: async () => events.push("begin"),
    commit: async () => events.push("commit"),
    rollback: async () => events.push("rollback"),
    release: () => events.push("release"),
  };

  try {
    pool.getConnection = async () => connection;

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

    userModel.findActiveDefaultScheme = async (tx) => {
      assert.strictEqual(tx, connection);
      events.push("default_scheme");
      return { id: 12, name: "Default Scheme" };
    };

    userModel.insertUser = async (fields, tx) => {
      assert.strictEqual(tx, connection);
      assert.equal(fields.schemeId, 12);
      assert.equal(fields.parentId, 5);
      assert.equal(fields.roleId, 8);
      events.push("insert_user");
      return 99;
    };

    userModel.insertSchemeAssignmentHistory = async (entry, tx) => {
      assert.strictEqual(tx, connection);

      assert.deepEqual(entry, {
        userId: 99,
        previousSchemeId: null,
        newSchemeId: 12,
        actorUserId: 5,
        changeSource: "user_creation",
        reason: "Initial Default Scheme assignment",
      });

      events.push("assignment_history");
      return 1;
    };

    userModel.initKycCaseForUser = async (
      { userId, actorId },
      tx,
    ) => {
      assert.strictEqual(tx, connection);
      assert.equal(userId, 99);
      assert.equal(actorId, 5);

      events.push("kyc");
      return {
        caseId: 1,
        status: "pending",
        stepsCompleted: 0,
      };
    };

    userModel.findUserSafeById = async (userId, tx) => {
      assert.strictEqual(tx, connection);
      assert.equal(userId, 99);

      return {
        id: userId,
        name: "Ramesh Retailer",
        role_id: 8,
        kyc: {
          status: "pending",
          steps_completed: 0,
          business_type: null,
        },
      };
    };

    const result = await userService.createUser({
      actorId: 5,
      name: "Ramesh Retailer",
      email: "ramesh@example.com",
      mobile: "9876543210",
      password: "Password@123",
      roleId: 8,
    });

    assert.equal(result.id, 99);

    assert.deepEqual(result.kyc, {
      status: "pending",
      steps_completed: 0,
      business_type: null,
    });

    assert.deepEqual(events, [
      "begin",
      "default_scheme",
      "insert_user",
      "assignment_history",
      "kyc",
      "commit",
      "release",
    ]);
  } finally {
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
    userModel.findActiveDefaultScheme = originals.findActiveDefaultScheme;
    userModel.insertUser = originals.insertUser;
    userModel.insertSchemeAssignmentHistory =
      originals.insertSchemeAssignmentHistory;
    userModel.initKycCaseForUser = originals.initKycCaseForUser;
    userModel.findUserSafeById = originals.findUserSafeById;
  }
});

test("user.service: missing Default Scheme rolls back and prevents user creation", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
    findActiveDefaultScheme: userModel.findActiveDefaultScheme,
    insertUser: userModel.insertUser,
  };

  const events = [];

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => events.push("begin"),
      commit: async () => events.push("commit"),
      rollback: async () => events.push("rollback"),
      release: () => events.push("release"),
    });

    userModel.findUserForAuth = async () => ({
      id: 1,
      role_id: 1,
      role_name: "Admin",
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 8,
      name: "Retailer",
    });

    authorizationService.canCreateRole = async () => true;
    userModel.checkDuplicateUser = async () => null;
    userModel.findActiveDefaultScheme = async () => null;

    userModel.insertUser = async () => {
      events.push("insert_user");
      throw new Error("User must not be inserted without Default Scheme");
    };

    await assert.rejects(
      userService.createUser({
        actorId: 1,
        name: "Test Retailer",
        email: "retailer@example.com",
        mobile: "9876543210",
        password: "Password@123",
        roleId: 8,
      }),
      (error) =>
        error.statusCode === 500 &&
        error.code === "DEFAULT_SCHEME_NOT_CONFIGURED",
    );

    assert.deepEqual(events, [
      "begin",
      "rollback",
      "release",
    ]);
  } finally {
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
    userModel.findActiveDefaultScheme = originals.findActiveDefaultScheme;
    userModel.insertUser = originals.insertUser;
  }
});

test("user.service: assignment-history error rolls back new user and skips KYC", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
    findActiveDefaultScheme: userModel.findActiveDefaultScheme,
    insertUser: userModel.insertUser,
    insertSchemeAssignmentHistory: userModel.insertSchemeAssignmentHistory,
    initKycCaseForUser: userModel.initKycCaseForUser,
  };

  const events = [];

  try {
    pool.getConnection = async () => ({
      beginTransaction: async () => events.push("begin"),
      commit: async () => events.push("commit"),
      rollback: async () => events.push("rollback"),
      release: () => events.push("release"),
    });

    userModel.findUserForAuth = async () => ({
      id: 1,
      role_id: 1,
      role_name: "Admin",
    });

    userModel.findRoleByIdOrName = async () => ({
      id: 8,
      name: "Retailer",
    });

    authorizationService.canCreateRole = async () => true;
    userModel.checkDuplicateUser = async () => null;

    userModel.findActiveDefaultScheme = async () => ({
      id: 12,
      name: "Default Scheme",
    });

    userModel.insertUser = async ({ schemeId }) => {
      assert.equal(schemeId, 12);
      events.push("insert_user");
      return 99;
    };

    userModel.insertSchemeAssignmentHistory = async () => {
      events.push("history_failed");
      throw new Error("History write failed");
    };

    userModel.initKycCaseForUser = async () => {
      events.push("kyc");
    };

    await assert.rejects(
      userService.createUser({
        actorId: 1,
        name: "Test Retailer",
        email: "retailer@example.com",
        mobile: "9876543210",
        password: "Password@123",
        roleId: 8,
      }),
      /History write failed/,
    );

    assert.deepEqual(events, [
      "begin",
      "insert_user",
      "history_failed",
      "rollback",
      "release",
    ]);
  } finally {
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
    userModel.findActiveDefaultScheme = originals.findActiveDefaultScheme;
    userModel.insertUser = originals.insertUser;
    userModel.insertSchemeAssignmentHistory =
      originals.insertSchemeAssignmentHistory;
    userModel.initKycCaseForUser = originals.initKycCaseForUser;
  }
});

test("user.service: normalizes mobile number across formats before duplicate check and insertion", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
    findActiveDefaultScheme: userModel.findActiveDefaultScheme,
    insertUser: userModel.insertUser,
    insertSchemeAssignmentHistory: userModel.insertSchemeAssignmentHistory,
    initKycCaseForUser: userModel.initKycCaseForUser,
    findUserSafeById: userModel.findUserSafeById,
  };

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

    userModel.findActiveDefaultScheme = async () => ({
      id: 12,
      name: "Default Scheme",
    });

    userModel.insertSchemeAssignmentHistory = async ({
      newSchemeId,
      changeSource,
    }) => {
      assert.equal(newSchemeId, 12);
      assert.equal(changeSource, "user_creation");
    };

    const formats = [
      "9876543210",
      "09876543210",
      "919876543210",
      "+919876543210",
    ];

    for (const rawMobile of formats) {
      let duplicateCheckMobile = null;
      let insertedMobile = null;

      userModel.checkDuplicateUser = async ({ mobile }) => {
        duplicateCheckMobile = mobile;
        return null;
      };

      userModel.insertUser = async ({ mobile, schemeId }) => {
        assert.equal(schemeId, 12);
        insertedMobile = mobile;
        return 101;
      };

      userModel.initKycCaseForUser = async () => ({});

      userModel.findUserSafeById = async (userId) => ({
        id: userId,
        mobile: insertedMobile,
      });

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
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
    userModel.findActiveDefaultScheme = originals.findActiveDefaultScheme;
    userModel.insertUser = originals.insertUser;
    userModel.insertSchemeAssignmentHistory =
      originals.insertSchemeAssignmentHistory;
    userModel.initKycCaseForUser = originals.initKycCaseForUser;
    userModel.findUserSafeById = originals.findUserSafeById;
  }
});

test("user.service: detects duplicate mobile across different formats", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
  };

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

    userModel.checkDuplicateUser = async ({ mobile }) => {
      if (mobile === "+919876543210") {
        return {
          id: 50,
          email: "existing@example.com",
          mobile: "+919876543210",
        };
      }
      return null;
    };

    const formats = [
      "9876543210",
      "09876543210",
      "919876543210",
      "+919876543210",
    ];

    for (const rawMobile of formats) {
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
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
  }
});

test("user.service: validates password and uses configured bcrypt salt rounds before hashing", async () => {
  const userModel = (await import("./user.model.js")).default;
  const userService = (await import("./user.service.js")).default;
  const authorizationService = (
    await import("../authorization/authorization.service.js")
  ).default;
  const pool = (await import("../../config/db.js")).default;
  const bcrypt = (await import("bcryptjs")).default;
  const { getAuthConfig } = await import("../../config/auth.js");

  const originals = {
    getConnection: pool.getConnection,
    findUserForAuth: userModel.findUserForAuth,
    findRoleByIdOrName: userModel.findRoleByIdOrName,
    canCreateRole: authorizationService.canCreateRole,
    checkDuplicateUser: userModel.checkDuplicateUser,
    findActiveDefaultScheme: userModel.findActiveDefaultScheme,
    insertSchemeAssignmentHistory: userModel.insertSchemeAssignmentHistory,
    insertUser: userModel.insertUser,
    initKycCaseForUser: userModel.initKycCaseForUser,
    findUserSafeById: userModel.findUserSafeById,
    hash: bcrypt.hash,
  };

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

    userModel.findActiveDefaultScheme = async () => ({
      id: 12,
      name: "Default Scheme",
    });

    userModel.insertSchemeAssignmentHistory = async ({
      newSchemeId,
    }) => {
      assert.equal(newSchemeId, 12);
    };

    let hashCalled = false;
    let usedSaltRounds = null;

    bcrypt.hash = async (_password, rounds) => {
      hashCalled = true;
      usedSaltRounds = rounds;
      return "mocked-hash";
    };

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
        assert.equal(
          err.message,
          "Password must contain at least 8 characters",
        );
        return true;
      },
    );

    assert.equal(hashCalled, false);

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

    userModel.insertUser = async ({ schemeId }) => {
      assert.equal(schemeId, 12);
      return 200;
    };

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
    assert.equal(
      usedSaltRounds,
      getAuthConfig().bcryptSaltRounds,
    );
  } finally {
    pool.getConnection = originals.getConnection;
    userModel.findUserForAuth = originals.findUserForAuth;
    userModel.findRoleByIdOrName = originals.findRoleByIdOrName;
    authorizationService.canCreateRole = originals.canCreateRole;
    userModel.checkDuplicateUser = originals.checkDuplicateUser;
    userModel.findActiveDefaultScheme = originals.findActiveDefaultScheme;
    userModel.insertSchemeAssignmentHistory =
      originals.insertSchemeAssignmentHistory;
    userModel.insertUser = originals.insertUser;
    userModel.initKycCaseForUser = originals.initKycCaseForUser;
    userModel.findUserSafeById = originals.findUserSafeById;
    bcrypt.hash = originals.hash;
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
  const getUserService = (
    await import("./get-user/get-user.service.js")
  ).default;

  const originals = {
    findActorRole: getUserModel.findActorRole,
    findAllUsers: getUserModel.findAllUsers,
    findChildrenByParentId: getUserModel.findChildrenByParentId,
  };

  try {
    let capturedFilter = null;

    getUserModel.findActorRole = async (actorId) => {
      if (actorId === 1) {
        return { id: 1, role_id: 1, role_slug: "AD" };
      }
      return { id: 5, role_id: 7, role_slug: "DT" };
    };

    getUserModel.findAllUsers = async (options) => {
      capturedFilter = options;
      return [{ id: 10, name: "User 10" }];
    };

    getUserModel.findChildrenByParentId = async (
      parentId,
      options,
    ) => {
      capturedFilter = options;
      return [{ id: 20, name: "User 20" }];
    };

    await getUserService.getUsers(1, {
      kycStatus: "under_review",
    });
    assert.deepEqual(capturedFilter, {
      kycStatus: "under_review",
    });

    await getUserService.getUsers(5, {
      kycStatus: "approved",
    });
    assert.deepEqual(capturedFilter, {
      kycStatus: "approved",
    });
  } finally {
    getUserModel.findActorRole = originals.findActorRole;
    getUserModel.findAllUsers = originals.findAllUsers;
    getUserModel.findChildrenByParentId =
      originals.findChildrenByParentId;
  }
});

test("get-user service: rejects invalid KYC status without querying users", async () => {
  const getUserModel = (await import("./get-user/get-user.model.js")).default;
  const getUserService = (
    await import("./get-user/get-user.service.js")
  ).default;

  const originals = {
    findActorRole: getUserModel.findActorRole,
    findAllUsers: getUserModel.findAllUsers,
    findChildrenByParentId: getUserModel.findChildrenByParentId,
  };

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
      getUserService.getUsers(1, {
        kycStatus: "invalid",
      }),
      (error) => {
        assert.equal(error.statusCode, 400);
        assert.equal(error.code, "VALIDATION_ERROR");
        assert.equal(error.message, "Invalid KYC status");
        return true;
      },
    );

    assert.equal(modelCalled, false);
  } finally {
    getUserModel.findActorRole = originals.findActorRole;
    getUserModel.findAllUsers = originals.findAllUsers;
    getUserModel.findChildrenByParentId =
      originals.findChildrenByParentId;
  }
});

test("get-user model: formatUserRow includes scheme without affecting KYC", async () => {
  const { formatUserRow } = await import(
    "./get-user/get-user.model.js"
  );

  const row = {
    id: 99,
    name: "Test Retailer",
    role_id: 8,
    scheme_id: 12,

    scheme_record_id: 12,
    scheme_name: "Default Scheme",
    scheme_status: 1,
    scheme_created_at: "2026-11-21T09:00:00.000Z",

    kyc_case_id: 45,
    kyc_status: "pending",
    kyc_steps_completed: 0,
    kyc_business_type: null,
  };

  const result = formatUserRow(row);

  assert.equal(result.scheme_id, 12);

  assert.deepEqual(result.scheme, {
    id: 12,
    name: "Default Scheme",
    status: "1",
    created_at: "2026-11-21T09:00:00.000Z",
  });

  assert.deepEqual(result.kyc, {
    status: "pending",
    steps_completed: 0,
    business_type: null,
  });

  assert.equal(result.scheme_record_id, undefined);
  assert.equal(result.scheme_name, undefined);
  assert.equal(result.scheme_status, undefined);
  assert.equal(result.scheme_created_at, undefined);
});
