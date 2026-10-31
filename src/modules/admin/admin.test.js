import assert from "node:assert/strict";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import pool from "../../config/db.js";
import { getAuthConfig } from "../../config/auth.js";
import { validateAdminInput } from "./admin.controller.js";
import { createAdmin } from "./admin.service.js";
import userService from "../users/user.service.js";
import userModel from "../users/user.model.js";
import authorizationService from "../authorization/authorization.service.js";

function runAdminValidator(body) {
  const req = { body };
  let responseData = null;
  let responseStatus = null;
  const res = {
    status(code) {
      responseStatus = code;
      return {
        json(data) {
          responseData = data;
          return this;
        },
      };
    },
  };
  let nextCalled = false;
  validateAdminInput(req, res, () => {
    nextCalled = true;
  });
  return { req, responseStatus, responseData, nextCalled };
}

test("admin.controller: normalizes all Indian mobile formats to canonical +91XXXXXXXXXX", () => {
  const formats = [
    "9876543210",
    "09876543210",
    "919876543210",
    "+919876543210",
  ];

  for (const rawMobile of formats) {
    const { req, nextCalled, responseStatus } = runAdminValidator({
      name: "Super Admin",
      email: "admin@example.com",
      mobile: rawMobile,
      companyName: "AquaPay Inc",
      password: "password123",
    });

    assert.equal(nextCalled, true);
    assert.equal(responseStatus, null);
    assert.equal(req.adminInput.mobile, "+919876543210");
  }
});

test("admin.controller: rejects invalid mobile numbers", () => {
  const invalidNumbers = [
    "5876543210",
    "12345",
    "abcdefghij",
    "0000000000",
  ];

  for (const mobile of invalidNumbers) {
    const { nextCalled, responseStatus, responseData } = runAdminValidator({
      name: "Super Admin",
      email: "admin@example.com",
      mobile,
      companyName: "AquaPay Inc",
      password: "password123",
    });

    assert.equal(nextCalled, false);
    assert.equal(responseStatus, 400);
    assert.equal(responseData.message, "Invalid mobile number");
  }
});

test("admin.controller: rejects non-string mobile input", () => {
  const { nextCalled, responseStatus, responseData } = runAdminValidator({
    name: "Super Admin",
    email: "admin@example.com",
    mobile: 9876543210,
    companyName: "AquaPay Inc",
    password: "password123",
  });

  assert.equal(nextCalled, false);
  assert.equal(responseStatus, 400);
  assert.equal(responseData.message, "All fields must be strings");
});

test("admin.controller: validates password bounds including multibyte characters", () => {
  // Shorter than 8 characters
  const shortResult = runAdminValidator({
    name: "Super Admin",
    email: "admin@example.com",
    mobile: "9876543210",
    companyName: "AquaPay Inc",
    password: "short",
  });
  assert.equal(shortResult.nextCalled, false);
  assert.equal(shortResult.responseStatus, 400);
  assert.equal(shortResult.responseData.message, "Password must be at least 8 characters");

  // Exceeding 72 UTF-8 bytes (ASCII 73 chars)
  const longResult = runAdminValidator({
    name: "Super Admin",
    email: "admin@example.com",
    mobile: "9876543210",
    companyName: "AquaPay Inc",
    password: "a".repeat(73),
  });
  assert.equal(longResult.nextCalled, false);
  assert.equal(longResult.responseStatus, 400);
  assert.equal(longResult.responseData.message, "Password must not exceed 72 bytes");

  // Multibyte exceeding 72 UTF-8 bytes (25 * 3 = 75 bytes)
  const multibyteLong = runAdminValidator({
    name: "Super Admin",
    email: "admin@example.com",
    mobile: "9876543210",
    companyName: "AquaPay Inc",
    password: "₹".repeat(25),
  });
  assert.equal(multibyteLong.nextCalled, false);
  assert.equal(multibyteLong.responseStatus, 400);
  assert.equal(multibyteLong.responseData.message, "Password must not exceed 72 bytes");

  // Valid multibyte password within 72 bytes
  const multibyteValid = runAdminValidator({
    name: "Super Admin",
    email: "admin@example.com",
    mobile: "9876543210",
    companyName: "AquaPay Inc",
    password: "Admin🔑Password123",
  });
  assert.equal(multibyteValid.nextCalled, true);
  assert.equal(multibyteValid.responseStatus, null);
  assert.equal(multibyteValid.req.adminInput.password, "Admin🔑Password123");
});

test("admin.service: normalizes mobile number across formats before duplicate check and insertion", async () => {
  const originalGetConnection = pool.getConnection;

  try {
    const formats = ["9876543210", "09876543210", "919876543210", "+919876543210"];

    for (const rawMobile of formats) {
      let duplicateCheckedMobile = null;
      let insertedMobile = null;

      const mockConnection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql, params) => {
          if (sql.includes("FROM users WHERE role_id = 1")) {
            return [[]]; // No existing admin
          }
          if (sql.includes("FROM companies WHERE name = ?")) {
            return [[{ id: 1 }]]; // Existing company
          }
          if (sql.includes("FROM users WHERE email = ? OR mobile = ?")) {
            duplicateCheckedMobile = params[1];
            return [[]]; // No duplicate
          }
          if (sql.includes("INSERT INTO users")) {
            insertedMobile = params[2];
            return [{ insertId: 1 }];
          }
          return [[]];
        },
      };

      pool.getConnection = async () => mockConnection;

      const admin = await createAdmin({
        name: "Super Admin",
        email: "admin@example.com",
        mobile: rawMobile,
        companyName: "AquaPay Inc",
        password: "password123",
      });

      assert.equal(admin.id, 1);
      assert.equal(duplicateCheckedMobile, "+919876543210");
      assert.equal(insertedMobile, "+919876543210");
    }
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test("admin.service: detects duplicate mobile across different formats", async () => {
  const originalGetConnection = pool.getConnection;

  try {
    const rawFormats = ["9876543210", "09876543210", "919876543210", "+919876543210"];

    for (const rawMobile of rawFormats) {
      const mockConnection = {
        beginTransaction: async () => {},
        commit: async () => {},
        rollback: async () => {},
        release: () => {},
        execute: async (sql, params) => {
          if (sql.includes("FROM users WHERE role_id = 1")) {
            return [[]]; // No existing admin
          }
          if (sql.includes("FROM companies WHERE name = ?")) {
            return [[{ id: 1 }]]; // Existing company
          }
          if (sql.includes("FROM users WHERE email = ? OR mobile = ?")) {
            // Existing user has canonical +919876543210
            if (params[1] === "+919876543210") {
              return [[{ id: 10 }]];
            }
            return [[]];
          }
          return [[]];
        },
      };

      pool.getConnection = async () => mockConnection;

      await assert.rejects(
        createAdmin({
          name: "Super Admin",
          email: "admin@example.com",
          mobile: rawMobile,
          companyName: "AquaPay Inc",
          password: "password123",
        }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.message, "Email or mobile already in use");
          return true;
        },
      );
    }
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test("admin.service: validates password and uses configured bcrypt salt rounds before hashing", async () => {
  const originalGetConnection = pool.getConnection;
  const originalHash = bcrypt.hash;

  try {
    const mockConnection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: async (sql) => {
        if (sql.includes("FROM users WHERE role_id = 1")) {
          return [[]]; // No existing admin
        }
        if (sql.includes("FROM companies WHERE name = ?")) {
          return [[{ id: 1 }]];
        }
        if (sql.includes("FROM users WHERE email = ? OR mobile = ?")) {
          return [[]];
        }
        if (sql.includes("INSERT INTO users")) {
          return [{ insertId: 1 }];
        }
        return [[]];
      },
    };

    pool.getConnection = async () => mockConnection;

    let hashCalled = false;
    let usedSaltRounds = null;
    bcrypt.hash = async (password, rounds) => {
      hashCalled = true;
      usedSaltRounds = rounds;
      return "mocked-admin-hash";
    };

    // 1. Password shorter than 8 characters rejected before hashing
    await assert.rejects(
      createAdmin({
        name: "Super Admin",
        email: "admin@example.com",
        mobile: "9876543210",
        companyName: "AquaPay Inc",
        password: "short",
      }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, "Password must be at least 8 characters");
        return true;
      },
    );
    assert.equal(hashCalled, false);

    // 2. Password exceeding 72 UTF-8 bytes rejected before hashing
    await assert.rejects(
      createAdmin({
        name: "Super Admin",
        email: "admin@example.com",
        mobile: "9876543210",
        companyName: "AquaPay Inc",
        password: "x".repeat(73),
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
      createAdmin({
        name: "Super Admin",
        email: "admin@example.com",
        mobile: "9876543210",
        companyName: "AquaPay Inc",
        password: "₹".repeat(25),
      }),
      (err) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.message, "Password must not exceed 72 bytes");
        return true;
      },
    );
    assert.equal(hashCalled, false);

    // 4. Valid password hashes with configured bcryptSaltRounds
    const admin = await createAdmin({
      name: "Super Admin",
      email: "admin@example.com",
      mobile: "9876543210",
      companyName: "AquaPay Inc",
      password: "StrongAdminPassword123",
    });

    assert.equal(admin.id, 1);
    assert.equal(hashCalled, true);
    assert.equal(usedSaltRounds, getAuthConfig().bcryptSaltRounds);
  } finally {
    pool.getConnection = originalGetConnection;
    bcrypt.hash = originalHash;
  }
});

test("bcrypt configuration is consistent across Admin and user creation", async () => {
  const originalGetConnection = pool.getConnection;
  const originalFindUserForAuth = userModel.findUserForAuth;
  const originalFindRoleByIdOrName = userModel.findRoleByIdOrName;
  const originalCanCreateRole = authorizationService.canCreateRole;
  const originalCheckDuplicateUser = userModel.checkDuplicateUser;
  const originalInsertUser = userModel.insertUser;
  const originalInitKycCaseForUser = userModel.initKycCaseForUser;
  const originalFindUserSafeById = userModel.findUserSafeById;
  const originalHash = bcrypt.hash;

  try {
    const mockConnection = {
      beginTransaction: async () => {},
      commit: async () => {},
      rollback: async () => {},
      release: () => {},
      execute: async (sql) => {
        if (sql.includes("FROM users WHERE role_id = 1")) return [[]];
        if (sql.includes("FROM companies WHERE name = ?")) return [[{ id: 1 }]];
        if (sql.includes("FROM users WHERE email = ? OR mobile = ?")) return [[]];
        if (sql.includes("INSERT INTO users")) return [{ insertId: 1 }];
        return [[]];
      },
    };

    pool.getConnection = async () => mockConnection;
    userModel.findUserForAuth = async () => ({ id: 1, role_id: 1, role_name: "Admin" });
    userModel.findRoleByIdOrName = async () => ({ id: 7, name: "Distributor" });
    authorizationService.canCreateRole = async () => true;
    userModel.checkDuplicateUser = async () => null;
    userModel.insertUser = async () => 10;
    userModel.initKycCaseForUser = async () => ({});
    userModel.findUserSafeById = async (id) => ({ id });

    const capturedRounds = [];
    bcrypt.hash = async (password, rounds) => {
      capturedRounds.push(rounds);
      return "mock-hash";
    };

    await createAdmin({
      name: "Admin",
      email: "admin@example.com",
      mobile: "9876543210",
      companyName: "AquaPay",
      password: "Password123",
    });

    await userService.createUser({
      actorId: 1,
      name: "User",
      email: "user@example.com",
      mobile: "9876543211",
      password: "Password123",
      roleId: 7,
    });

    assert.equal(capturedRounds.length, 2);
    // Both must match each other and match getAuthConfig().bcryptSaltRounds
    assert.equal(capturedRounds[0], getAuthConfig().bcryptSaltRounds);
    assert.equal(capturedRounds[1], getAuthConfig().bcryptSaltRounds);
    assert.equal(capturedRounds[0], capturedRounds[1]);
  } finally {
    pool.getConnection = originalGetConnection;
    userModel.findUserForAuth = originalFindUserForAuth;
    userModel.findRoleByIdOrName = originalFindRoleByIdOrName;
    authorizationService.canCreateRole = originalCanCreateRole;
    userModel.checkDuplicateUser = originalCheckDuplicateUser;
    userModel.insertUser = originalInsertUser;
    userModel.initKycCaseForUser = originalInitKycCaseForUser;
    userModel.findUserSafeById = originalFindUserSafeById;
    bcrypt.hash = originalHash;
  }
});
