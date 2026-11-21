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
  const originalFindActiveDefaultScheme = userModel.findActiveDefaultScheme;
  const originalInsertSchemeAssignmentHistory = userModel.insertSchemeAssignmentHistory;
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
    userModel.findActiveDefaultScheme = async () => ({ id: 1, name: "Default Scheme" });
    userModel.insertSchemeAssignmentHistory = async () => 1;
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
    userModel.findActiveDefaultScheme = originalFindActiveDefaultScheme;
    userModel.insertSchemeAssignmentHistory = originalInsertSchemeAssignmentHistory;
    userModel.initKycCaseForUser = originalInitKycCaseForUser;
    userModel.findUserSafeById = originalFindUserSafeById;
    bcrypt.hash = originalHash;
  }
});

// Phase 3 Scheme Manager regression tests (no database connection required).
test("scheme.service: lists and searches schemes without exposing SQL aliases", async () => {
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const originalExecute = pool.execute;
  const calls = [];
  try {
    pool.execute = async (sql, params) => {
      calls.push({ sql, params });
      return [[{
        id: 1, name: "Default Scheme", status: 1, is_default: 1,
        created_at: "2026-11-21T10:00:00.000Z",
      }]];
    };

    const all = await schemeService.getSchemes();
    assert.deepEqual(all, [{
      id: 1, name: "Default Scheme", status: "1", is_default: true,
      created_at: "2026-11-21T10:00:00.000Z",
    }]);
    assert.deepEqual(calls[0].params, []);
    assert.match(calls[0].sql, /ORDER BY id ASC/);

    await schemeService.getSchemes("Premium");
    assert.deepEqual(calls[1].params, ["%Premium%"]);
    assert.match(calls[1].sql, /WHERE name LIKE \?/);
  } finally {
    pool.execute = originalExecute;
  }
});

test("scheme.service: creates a non-default scheme and rejects duplicate names", async () => {
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const originalExecute = pool.execute;
  let duplicate = false;
  try {
    pool.execute = async (sql, params) => {
      if (sql.includes("INSERT INTO schemes")) {
        assert.deepEqual(params, ["Premium Scheme"]);
        assert.match(sql, /VALUES \(\?, 1, 0\)/);
        if (duplicate) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" });
        return [{ insertId: 7 }];
      }
      assert.deepEqual(params, [7]);
      return [[{ id: 7, name: "Premium Scheme", status: 1, is_default: 0 }]];
    };

    const created = await schemeService.createScheme("Premium Scheme");
    assert.equal(created.id, 7);
    assert.equal(created.is_default, false);
    assert.equal(created.status, "1");

    duplicate = true;
    await assert.rejects(schemeService.createScheme("Premium Scheme"),
      (error) => error.statusCode === 409 && error.code === "DUPLICATE_SCHEME");
  } finally {
    pool.execute = originalExecute;
  }
});

test("scheme.service: protects Default Scheme from deactivation and allows no-op updates", async () => {
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const originalExecute = pool.execute;
  let writes = 0;
  try {
    pool.execute = async (sql) => {
      if (sql.includes("UPDATE schemes")) writes += 1;
      return [[{ id: 1, name: "Default Scheme", status: 1, is_default: 1 }]];
    };

    await assert.rejects(schemeService.updateSchemeStatus(1, 0),
      (error) => error.statusCode === 403 && error.code === "DEFAULT_SCHEME_PROTECTED");
    const unchanged = await schemeService.updateSchemeStatus(1, 1);
    assert.equal(unchanged.status, "1");
    assert.equal(writes, 0);
  } finally {
    pool.execute = originalExecute;
  }
});

test("scheme.service: changes status only for non-default schemes", async () => {
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const originalExecute = pool.execute;
  let status = 1;
  let updateCount = 0;
  try {
    pool.execute = async (sql, params) => {
      if (sql.includes("UPDATE schemes")) {
        assert.match(sql, /AND is_default = 0/);
        assert.deepEqual(params, [0, 7]);
        status = params[0];
        updateCount += 1;
        return [{ affectedRows: 1 }];
      }
      return [[{ id: 7, name: "Premium Scheme", status, is_default: 0 }]];
    };

    const updated = await schemeService.updateSchemeStatus(7, 0);
    assert.equal(updated.status, "0");
    assert.equal(updateCount, 1);
    await schemeService.updateSchemeStatus(7, 0);
    assert.equal(updateCount, 1);
  } finally {
    pool.execute = originalExecute;
  }
});

test("scheme.controller: validates names, search and status before writing", async () => {
  const controllers = await import("./schemes/scheme.controller.js");
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const originals = {
    getSchemes: schemeService.getSchemes,
    createScheme: schemeService.createScheme,
    updateSchemeStatus: schemeService.updateSchemeStatus,
  };
  const errors = [];
  const response = { status() { return this; }, json() { return this; } };
  const next = (error) => errors.push(error);
  try {
    schemeService.getSchemes = async () => { throw new Error("Invalid request reached service"); };
    schemeService.createScheme = async () => { throw new Error("Invalid request reached service"); };
    schemeService.updateSchemeStatus = async () => { throw new Error("Invalid request reached service"); };

    await controllers.createSchemeController({ body: { name: "   " } }, response, next);
    await controllers.createSchemeController({ body: { name: "x".repeat(101) } }, response, next);
    await controllers.getSchemesController({ query: { search: ["a", "b"] } }, response, next);
    await controllers.updateSchemeStatusController({ params: { schemeId: "1e2" }, body: { status: 1 } }, response, next);
    await controllers.updateSchemeStatusController({ params: { schemeId: "2" }, body: { status: 2 } }, response, next);

    assert.equal(errors.length, 5);
    for (const error of errors) {
      assert.equal(error.statusCode, 400);
      assert.equal(error.code, "VALIDATION_ERROR");
    }
  } finally {
    Object.assign(schemeService, originals);
  }
});

test("scheme.routes: requires authentication and Admin role", async () => {
  const app = (await import("../../app.js")).default;
  const authModel = (await import("../auth/auth.model.js")).default;
  const schemeService = (await import("./schemes/scheme.service.js")).default;
  const jwt = (await import("jsonwebtoken")).default;
  const originals = {
    jwtSecret: process.env.JWT_SECRET,
    isUserActive: authModel.isUserActive,
    isAdmin: authModel.isAdmin,
    getSchemes: schemeService.getSchemes,
  };
  let server;
  try {
    process.env.JWT_SECRET = "aquapay-test-only-jwt-secret-with-40-characters";
    authModel.isUserActive = async () => true;
    let adminAllowed = false;
    authModel.isAdmin = async () => adminAllowed;
    schemeService.getSchemes = async () => [{ id: 1, name: "Default Scheme" }];
    const token = jwt.sign({}, process.env.JWT_SECRET, {
      subject: "5",
      issuer: "aquapay-api",
      audience: "aquapay-client",
      expiresIn: "5m",
    });
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const url = `http://127.0.0.1:${server.address().port}/api/admin/schemes`;

    const unauthenticated = await fetch(url);
    assert.equal(unauthenticated.status, 401);
    const nonAdmin = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(nonAdmin.status, 403);
    adminAllowed = true;
    const admin = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    assert.equal(admin.status, 200);
    const response = await admin.json();
    assert.equal(response.success, true);
    assert.equal(response.data[0].name, "Default Scheme");
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    if (originals.jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originals.jwtSecret;
    authModel.isUserActive = originals.isUserActive;
    authModel.isAdmin = originals.isAdmin;
    schemeService.getSchemes = originals.getSchemes;
  }
});
