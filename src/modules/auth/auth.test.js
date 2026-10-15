const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");

process.env.JWT_SECRET = "unit-test-secret-that-is-longer-than-32-characters";
process.env.JWT_EXPIRES_IN = "1h";
process.env.DB_HOST = "127.0.0.1";
process.env.DB_PORT = "1";
process.env.DB_USER = "unit_test_user";
process.env.DB_PASSWORD = "unit-test-only-password";
process.env.DB_NAME = "auth_unit_test_database";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("../../config/db");
const authModel = require("./auth.model");
const authService = require("./auth.service");
const recoveryDelivery = require("./recoveryDelivery");
const app = require("../../app");
const { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } = require("../../config/auth");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { errorHandler } = require("../../middlewares/error.middleware");
const { createRateLimiter } = require("../../middlewares/authRateLimit.middleware");
const {
  normalizeIdentifier,
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require("./auth.validator");

function activeUser(overrides = {}) {
  return {
    id: "42",
    name: "Example User",
    email: "user@example.com",
    mobile: "+14155552671",
    password_hash: "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    role_id: 2,
    company_id: null,
    parent_id: null,
    status: "active",
    role_name: "Admin",
    company_name: null,
    ...overrides
  };
}

function validate(middleware, body) {
  const req = { body };
  let error;
  middleware(req, {}, (nextError) => { error = nextError; });
  return { req, error };
}

async function runAuth(authorization) {
  const req = { get: () => authorization };
  let error;
  await requireAuth(req, {}, (nextError) => { error = nextError; });
  return { req, error };
}

test("normalizes valid email/mobile identifiers and rejects malformed values", () => {
  assert.deepEqual(normalizeIdentifier(" User@Example.com "), { identifier: "user@example.com", type: "email" });
  assert.deepEqual(normalizeIdentifier(" +14155552671 "), { identifier: "+14155552671", type: "mobile" });
  assert.equal(normalizeIdentifier("bad"), null);
  assert.equal(normalizeIdentifier("first..last@example.com"), null);
  assert.equal(normalizeIdentifier("first@example..com"), null);
  assert.equal(normalizeIdentifier("5551234567 OR 1=1"), null);
});

test("validators reject missing, oversized, and unexpected input", () => {
  assert.equal(validate(validateLogin, {}).error.code, "VALIDATION_ERROR");
  assert.equal(validate(validateLogin, { identifier: "user@example.com", password: "x".repeat(73) }).error.code, "VALIDATION_ERROR");
  assert.equal(validate(validateLogin, { identifier: "user@example.com", password: "secret123", role: "Admin" }).error.code, "VALIDATION_ERROR");
  assert.equal(validate(validateForgotPassword, {}).error.code, "VALIDATION_ERROR");
  assert.equal(validate(validateResetPassword, { token: "bad", password: "short" }).error.code, "VALIDATION_ERROR");
});

test("auth configuration rejects missing or weak JWT secrets", () => {
  const previous = process.env.JWT_SECRET;
  const previousExpiry = process.env.JWT_EXPIRES_IN;
  delete process.env.JWT_SECRET;
  assert.throws(() => getAuthConfig(), /JWT_SECRET/);
  process.env.JWT_SECRET = previous;
  process.env.JWT_EXPIRES_IN = "999999999999999999999h";
  assert.throws(() => getAuthConfig(), /JWT_EXPIRES_IN/);
  process.env.JWT_EXPIRES_IN = previousExpiry;
  assert.equal(getAuthConfig().bcryptSaltRounds, 12);
});

test("auth SQL targets original schema columns and parameterizes identifiers", async () => {
  const originalExecute = pool.execute;
  let sql;
  let values;
  pool.execute = async (query, params) => { sql = query; values = params; return [[activeUser()]]; };
  try {
    await authModel.findUserByIdentifier("user@example.com", "email");
    assert.match(sql, /u\.full_name AS name/);
    assert.match(sql, /u\.parent_user_id AS parent_id/);
    assert.match(sql, /c\.company_name AS company_name/);
    assert.match(sql, /WHERE u\.email = \?/);
    assert.deepEqual(values, ["user@example.com"]);
    assert.doesNotMatch(sql, /u\.name|u\.parent_id|c\.name|r\.slug/);
  } finally {
    pool.execute = originalExecute;
  }
});

test("database startup verification accepts Oracle MySQL metadata and rejects MariaDB", async () => {
  const originalQuery = pool.query;
  try {
    pool.query = async () => [[{ version: "26.7.0", versionComment: "MySQL Community Server - GPL" }]];
    assert.deepEqual(await pool.verifyOracleMySql(), {
      version: "26.7.0",
      versionComment: "MySQL Community Server - GPL"
    });
    pool.query = async () => [[{ version: "10.4.32-MariaDB", versionComment: "mariadb.org binary distribution" }]];
    await assert.rejects(pool.verifyOracleMySql(), /not Oracle MySQL/);
  } finally {
    pool.query = originalQuery;
  }
});

test("database config requires explicit connection values and rejects invalid ports", () => {
  const previous = process.env.DB_PORT;
  delete process.env.DB_PORT;
  assert.throws(() => pool.getDatabaseConfig(), /Missing required database configuration/);
  process.env.DB_PORT = "3306.5";
  assert.throws(() => pool.getDatabaseConfig(), /DB_PORT must be a valid TCP port/);
  process.env.DB_PORT = previous;
});

test("login issues a signed JWT for active email and mobile accounts without exposing hashes", async () => {
  const originalFind = authModel.findUserByIdentifier;
  const hash = await bcrypt.hash("correct-password", 4);
  authModel.findUserByIdentifier = async (identifier, type) => {
    assert.equal(type, identifier.includes("@") ? "email" : "mobile");
    return activeUser({ password_hash: hash });
  };
  try {
    for (const [identifier, type] of [["user@example.com", "email"], ["+14155552671", "mobile"]]) {
      const result = await authService.login({ identifier, type, password: "correct-password" });
      const payload = jwt.verify(result.accessToken, getAuthConfig().secret, {
        algorithms: ["HS256"], issuer: JWT_ISSUER, audience: JWT_AUDIENCE
      });
      assert.equal(payload.sub, "42");
      assert.equal(result.user.name, "Example User");
      assert.equal(JSON.stringify(result).includes(hash), false);
      assert.equal(JSON.stringify(result).includes("correct-password"), false);
    }
  } finally {
    authModel.findUserByIdentifier = originalFind;
  }
});

test("wrong password, unknown user, missing hash, and inactive status share a generic failure", async () => {
  const originalFind = authModel.findUserByIdentifier;
  const hash = await bcrypt.hash("correct-password", 4);
  authModel.findUserByIdentifier = async (identifier) => {
    if (identifier === "missing@example.com") return null;
    if (identifier === "nohash@example.com") return activeUser({ password_hash: null });
    if (identifier === "suspended@example.com") return activeUser({ password_hash: hash, status: "suspended" });
    if (identifier === "pending@example.com") return activeUser({ password_hash: hash, status: "pending" });
    return activeUser({ password_hash: hash });
  };
  try {
    const cases = [
      ["user@example.com", "wrong-password"],
      ["missing@example.com", "correct-password"],
      ["nohash@example.com", "correct-password"],
      ["suspended@example.com", "correct-password"],
      ["pending@example.com", "correct-password"]
    ];
    const failures = [];
    for (const [identifier, password] of cases) {
      await assert.rejects(authService.login({ identifier, type: "email", password }), (error) => {
        failures.push([error.statusCode, error.code, error.message]);
        return true;
      });
    }
    assert.equal(new Set(failures.map(JSON.stringify)).size, 1);
  } finally {
    authModel.findUserByIdentifier = originalFind;
  }
});

test("unknown-account login uses a dummy bcrypt hash at the configured cost and remains generic", async () => {
  const originalFind = authModel.findUserByIdentifier;
  const originalCompare = bcrypt.compare;
  let comparedHash;
  authModel.findUserByIdentifier = async () => null;
  bcrypt.compare = async (_password, hash) => { comparedHash = hash; return false; };
  try {
    await assert.rejects(
      authService.login({ identifier: "missing@example.com", type: "email", password: "correct-password" }),
      (error) => error.statusCode === 401 && error.code === "INVALID_CREDENTIALS" && error.message === "Invalid email/mobile or password"
    );
    assert.equal(bcrypt.getRounds(comparedHash), getAuthConfig().bcryptSaltRounds);
  } finally {
    authModel.findUserByIdentifier = originalFind;
    bcrypt.compare = originalCompare;
  }
});

test("authentication database failures return a safe service-unavailable error", async () => {
  const originalFind = authModel.findUserByIdentifier;
  authModel.findUserByIdentifier = async () => { throw new Error("database credentials leaked"); };
  try {
    await assert.rejects(
      authService.login({ identifier: "user@example.com", type: "email", password: "correct-password" }),
      (error) => error.statusCode === 503 && error.code === "SERVICE_UNAVAILABLE" && !error.message.includes("credentials")
    );
  } finally {
    authModel.findUserByIdentifier = originalFind;
  }
});

test("JWT middleware enforces signature, expiry, and active account status", async () => {
  const originalActive = authModel.isUserActive;
  authModel.isUserActive = async () => true;
  const expired = jwt.sign({}, getAuthConfig().secret, {
    algorithm: "HS256", issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: -1, subject: "42"
  });
  try {
    for (const header of [undefined, "Basic abc", "Bearer invalid", `Bearer ${expired}`]) {
      const { error } = await runAuth(header);
      assert.equal(error.statusCode, 401);
    }
    const token = jwt.sign({}, getAuthConfig().secret, {
      algorithm: "HS256", issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: "1h", subject: "42"
    });
    const missingExpiry = jwt.sign({}, getAuthConfig().secret, {
      algorithm: "HS256", issuer: JWT_ISSUER, audience: JWT_AUDIENCE, subject: "42"
    });
    assert.equal((await runAuth(`Bearer ${missingExpiry}`)).error.statusCode, 401);
    const missingSubject = jwt.sign({}, getAuthConfig().secret, {
      algorithm: "HS256", issuer: JWT_ISSUER, audience: JWT_AUDIENCE, expiresIn: "1h"
    });
    assert.equal((await runAuth(`Bearer ${missingSubject}`)).error.statusCode, 401);
    const [header, payload, signature] = token.split(".");
    const badSignature = `${header}.${payload}.${signature.startsWith("a") ? "b" : "a"}${signature.slice(1)}`;
    assert.equal((await runAuth(`Bearer ${badSignature}`)).error.statusCode, 401);
    assert.deepEqual((await runAuth(`Bearer ${token}`)).req.user, { id: "42" });
    authModel.isUserActive = async () => false;
    assert.equal((await runAuth(`Bearer ${token}`)).error.statusCode, 401);
    authModel.isUserActive = async () => { throw new Error("database unavailable"); };
    assert.equal((await runAuth(`Bearer ${token}`)).error.statusCode, 503);
  } finally {
    authModel.isUserActive = originalActive;
  }
});

test("health and auth endpoints respond with the documented authorization and safe-profile behavior", async () => {
  const originalActive = authModel.isUserActive;
  const originalFind = authModel.findActiveUserById;
  const originalFindByIdentifier = authModel.findUserByIdentifier;
  const originalExecute = pool.execute;
  authModel.isUserActive = async () => true;
  authModel.findActiveUserById = async () => activeUser();
  authModel.findUserByIdentifier = async () => activeUser({ password_hash: await bcrypt.hash("correct-password", 4) });
  pool.execute = async (sql) => sql.includes("SELECT request_count")
    ? [[{ request_count: 1 }]]
    : [{ affectedRows: 1 }];
  const server = app.listen(0);
  try {
    assert.equal(app.get("trust proxy"), false);
    await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    const unknown = await fetch(`${base}/api/not-a-route`);
    assert.equal(unknown.status, 404);
    const malformed = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{"
    });
    assert.equal(malformed.status, 400);
    assert.equal((await malformed.json()).message, "Invalid request body");
    const oversizedBody = JSON.stringify({ identifier: "user@example.com", password: "x".repeat(17 * 1024) });
    const oversized = await fetch(`${base}/api/auth/login`, {
      method: "POST", headers: { "content-type": "application/json" }, body: oversizedBody
    });
    assert.equal(oversized.status, 413);
    const noAuth = await fetch(`${base}/api/auth/me`);
    assert.equal(noAuth.status, 401);
    const login = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ identifier: "user@example.com", password: "correct-password" })
    });
    assert.equal(login.status, 200);
    const loginBody = await login.json();
    assert.equal(JSON.stringify(loginBody).includes("password_hash"), false);
    const response = await fetch(`${base}/api/auth/me`, {
      headers: { authorization: `Bearer ${loginBody.data.accessToken}` }
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.name, "Example User");
    assert.equal(JSON.stringify(body).includes("password_hash"), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    authModel.isUserActive = originalActive;
    authModel.findActiveUserById = originalFind;
    authModel.findUserByIdentifier = originalFindByIdentifier;
    pool.execute = originalExecute;
  }
});

test("forgot password stays generic and stores no token without an approved provider", async () => {
  const originalConfigured = recoveryDelivery.isConfigured;
  const originalFind = authModel.findUserByIdentifier;
  const originalCreate = authModel.createPasswordReset;
  recoveryDelivery.isConfigured = () => false;
  authModel.findUserByIdentifier = async () => { throw new Error("must not enumerate accounts"); };
  authModel.createPasswordReset = async () => { throw new Error("must not create an undeliverable token"); };
  try {
    const result = await authService.forgotPassword({ identifier: "user@example.com", type: "email" });
    assert.match(result.message, /If the account exists/);
    assert.equal(JSON.stringify(result).includes("token"), false);
  } finally {
    recoveryDelivery.isConfigured = originalConfigured;
    authModel.findUserByIdentifier = originalFind;
    authModel.createPasswordReset = originalCreate;
  }
});

test("configured recovery stores only a hash and returns the same generic response", async () => {
  const originalConfigured = recoveryDelivery.isConfigured;
  const originalSend = recoveryDelivery.sendPasswordReset;
  const originalFind = authModel.findUserByIdentifier;
  const originalCreate = authModel.createPasswordReset;
  let stored;
  let delivered;
  recoveryDelivery.isConfigured = () => true;
  recoveryDelivery.sendPasswordReset = async (payload) => { delivered = payload; };
  authModel.findUserByIdentifier = async () => activeUser();
  authModel.createPasswordReset = async (payload) => { stored = payload; return new Date(); };
  try {
    const result = await authService.forgotPassword({ identifier: "user@example.com", type: "email" });
    assert.equal(delivered.token.length, 43);
    assert.equal(stored.tokenHash, crypto.createHash("sha256").update(delivered.token).digest("hex"));
    assert.equal(JSON.stringify(result).includes(delivered.token), false);
  } finally {
    recoveryDelivery.isConfigured = originalConfigured;
    recoveryDelivery.sendPasswordReset = originalSend;
    authModel.findUserByIdentifier = originalFind;
    authModel.createPasswordReset = originalCreate;
  }
});

test("reset validates before hashing and only one concurrent request consumes a token", async () => {
  const originalValid = authModel.hasValidPasswordReset;
  const originalConsume = authModel.consumePasswordReset;
  const originalSendChanged = recoveryDelivery.sendPasswordChanged;
  const originalConfigured = recoveryDelivery.isConfigured;
  recoveryDelivery.isConfigured = () => false;
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  let used = false;
  authModel.hasValidPasswordReset = async (hash) => hash === tokenHash;
  authModel.consumePasswordReset = async ({ tokenHash: hash, passwordHash }) => {
    assert.equal(hash, tokenHash);
    if (used) return null;
    used = true;
    assert.equal(await bcrypt.compare("new-password", passwordHash), true);
    return { email: "user@example.com", mobile: "+14155552671" };
  };
  try {
    let hashCalls = 0;
    const originalHash = bcrypt.hash;
    bcrypt.hash = async (...args) => { hashCalls += 1; return originalHash(...args); };
    try {
      const results = await Promise.allSettled([
        authService.resetPassword({ token, password: "new-password" }),
        authService.resetPassword({ token, password: "new-password" })
      ]);
      assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(results.filter((result) => result.status === "rejected" && result.reason.code === "INVALID_RESET_TOKEN").length, 1);
      assert.equal(hashCalls, 2);
    } finally {
      bcrypt.hash = originalHash;
    }

    authModel.hasValidPasswordReset = async () => false;
    let shouldNotHash = true;
    const oldHash = bcrypt.hash;
    bcrypt.hash = async () => { shouldNotHash = false; throw new Error("hash should not be called"); };
    try {
      await assert.rejects(authService.resetPassword({ token, password: "new-password" }), { code: "INVALID_RESET_TOKEN" });
      assert.equal(shouldNotHash, true);
    } finally {
      bcrypt.hash = oldHash;
    }
  } finally {
    authModel.hasValidPasswordReset = originalValid;
    authModel.consumePasswordReset = originalConsume;
    recoveryDelivery.sendPasswordChanged = originalSendChanged;
    recoveryDelivery.isConfigured = originalConfigured;
  }
});

test("expired recovery tokens are rejected before password hashing", async () => {
  const originalValid = authModel.hasValidPasswordReset;
  const originalHash = bcrypt.hash;
  const expiredToken = crypto.randomBytes(32).toString("base64url");
  let hashCalled = false;
  authModel.hasValidPasswordReset = async () => false;
  bcrypt.hash = async () => { hashCalled = true; throw new Error("must not hash an expired token"); };
  try {
    await assert.rejects(
      authService.resetPassword({ token: expiredToken, password: "new-password" }),
      { code: "INVALID_RESET_TOKEN" }
    );
    assert.equal(hashCalled, false);
  } finally {
    authModel.hasValidPasswordReset = originalValid;
    bcrypt.hash = originalHash;
  }
});

test("password-reset transaction failures roll back and release the connection", async () => {
  const originalGetConnection = pool.getConnection;
  const calls = [];
  pool.getConnection = async () => ({
    async beginTransaction() { calls.push("begin"); },
    async execute(sql) {
      calls.push(sql.startsWith("INSERT") ? "insert" : "execute");
      if (sql.startsWith("INSERT")) throw new Error("simulated insert failure");
      return [[], []];
    },
    async commit() { calls.push("commit"); },
    async rollback() { calls.push("rollback"); },
    release() { calls.push("release"); }
  });
  try {
    await assert.rejects(authModel.createPasswordReset({ userId: 42, tokenHash: "a".repeat(64), ttlMinutes: 15 }));
    assert.deepEqual(calls, ["begin", "execute", "execute", "insert", "rollback", "release"]);
  } finally {
    pool.getConnection = originalGetConnection;
  }
});

test("rate limiting blocks excess identifiers and fails closed when storage is unavailable", async () => {
  const counters = new Map();
  const limiter = createRateLimiter({
    incrementCounter: async (hash, window) => {
      const key = `${hash}:${window}`;
      const count = (counters.get(key) || 0) + 1;
      counters.set(key, count);
      return count;
    }
  })("login");
  let blocked = 0;
  let retryAfter;
  const oldError = console.error;
  console.error = () => {};
  try {
    for (let i = 0; i < 11; i += 1) {
      await limiter({ ip: "127.0.0.1", headers: { "x-forwarded-for": "203.0.113.7" }, body: { identifier: "user@example.com" } }, { set(name, value) { if (name === "Retry-After") retryAfter = value; } }, (error) => {
        if (error?.code === "RATE_LIMITED") blocked += 1;
        else assert.equal(error, undefined);
      });
    }
    assert.equal(blocked, 1);
    assert.match(retryAfter, /^[1-9]\d*$/);
    const failed = createRateLimiter({ incrementCounter: async () => { throw new Error("db down"); } })("forgotPassword");
    let error;
    await failed({ ip: "127.0.0.1", body: {} }, { set() {} }, (nextError) => { error = nextError; });
    assert.equal(error.statusCode, 503);
  } finally {
    console.error = oldError;
  }
});

test("shared error middleware does not return or log raw SQL error details", () => {
  const originalError = console.error;
  const logs = [];
  const response = {
    headersSent: false,
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(body) { this.body = body; return this; }
  };
  console.error = (...args) => logs.push(args);
  try {
    errorHandler(Object.assign(new Error("SQL contained a password secret"), {
      code: "ER_ACCESS_DENIED_ERROR",
      sql: "SELECT * FROM users WHERE password='secret'"
    }), {}, response, () => {});
    assert.equal(response.statusCode, 500);
    assert.equal(response.body.message, "Internal server error");
    assert.equal(JSON.stringify(response.body).includes("secret"), false);
    assert.equal(JSON.stringify(logs).includes("secret"), false);
  } finally {
    console.error = originalError;
  }
});
