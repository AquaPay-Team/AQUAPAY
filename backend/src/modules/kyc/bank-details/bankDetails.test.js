import "../../auth/setupEnv.js";

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { validateBankDetails } from "./bankDetails.validator.js";
import {
  encryptAccountNumber,
  decryptAccountNumber,
} from "./bankAccountEncryption.js";

import bankDetailsService from "./bankDetails.service.js";
import bankDetailsModel from "./bankDetails.model.js";
import * as bankDetailsModelFunctions from "./bankDetails.model.js";
import authModel from "../../auth/auth.model.js";
import ApiError from "../../../utils/ApiError.js";

// ------------------------------------------------------------
// Encryption configuration
// ------------------------------------------------------------

const originalEncryptionKey = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

process.env.BANK_ACCOUNT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString(
  "base64",
);

after(() => {
  if (originalEncryptionKey === undefined) {
    delete process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
  } else {
    process.env.BANK_ACCOUNT_ENCRYPTION_KEY = originalEncryptionKey;
  }
});

// ------------------------------------------------------------
// Validation tests
// ------------------------------------------------------------

function runValidator(body) {
  const req = { body };

  validateBankDetails(req, {}, (error) => {
    if (error) throw error;
  });

  return req.validatedBody;
}

test("Bank validation: accepts valid details", () => {
  const result = runValidator({
    ifscCode: "HDFC0001234",
    accountNumber: "123456789012",
  });

  assert.deepEqual(result, {
    ifscCode: "HDFC0001234",
    accountNumber: "123456789012",
  });
});

test("Bank validation: normalizes IFSC code", () => {
  const result = runValidator({
    ifscCode: "hdfc0001234",
    accountNumber: "123456789012",
  });

  assert.equal(result.ifscCode, "HDFC0001234");
});

test("Bank validation: rejects invalid IFSC", () => {
  assert.throws(() =>
    runValidator({
      ifscCode: "INVALID123",
      accountNumber: "123456789012",
    }),
  );
});

test("Bank validation: rejects account number shorter than 9 digits", () => {
  assert.throws(() =>
    runValidator({
      ifscCode: "HDFC0001234",
      accountNumber: "12345678",
    }),
  );
});

test("Bank validation: rejects account number longer than 18 digits", () => {
  assert.throws(() =>
    runValidator({
      ifscCode: "HDFC0001234",
      accountNumber: "1234567890123456789",
    }),
  );
});

test("Bank validation: rejects non-numeric account number", () => {
  assert.throws(() =>
    runValidator({
      ifscCode: "HDFC0001234",
      accountNumber: "12345ABC9012",
    }),
  );
});

test("Bank validation: rejects unexpected fields", () => {
  assert.throws(() =>
    runValidator({
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "123456789012",
      accountHolderName: "Test User",
    }),
  );
});

test("Bank validation: rejects missing request body", () => {
  assert.throws(() => runValidator(undefined));
});

// ------------------------------------------------------------
// Encryption tests
// ------------------------------------------------------------

test("Bank encryption: encrypts and decrypts account number", () => {
  const accountNumber = "123456789012";
  const encrypted = encryptAccountNumber(accountNumber);

  assert.ok(Buffer.isBuffer(encrypted));
  assert.notEqual(encrypted.toString(), accountNumber);
  assert.equal(decryptAccountNumber(encrypted), accountNumber);
});

test("Bank encryption: repeated encryption produces different ciphertext", () => {
  const accountNumber = "123456789012";
  const first = encryptAccountNumber(accountNumber);
  const second = encryptAccountNumber(accountNumber);

  assert.notDeepEqual(first, second);
  assert.equal(decryptAccountNumber(first), accountNumber);
  assert.equal(decryptAccountNumber(second), accountNumber);
});

test("Bank encryption: detects tampered encrypted data", () => {
  const encrypted = encryptAccountNumber("123456789012");
  const tampered = Buffer.from(encrypted);

  tampered[tampered.length - 1] ^= 1;

  assert.throws(() => decryptAccountNumber(tampered));
});

// ------------------------------------------------------------
// Test helpers
// ------------------------------------------------------------

const originalModelMethods = {};
const originalIncrementRateLimitCounter = authModel.incrementRateLimitCounter;

function mockBankAttemptCounter(count = 1) {
  authModel.incrementRateLimitCounter = async (hash, windowStart, expiresAt, connection) => {
    assert.match(hash, /^[a-f0-9]{64}$/);
    assert.equal(typeof windowStart, "string");
    assert.equal(typeof expiresAt, "string");
    assert.ok(connection);
    return count;
  };
}

function restoreBankAttemptCounter() {
  authModel.incrementRateLimitCounter = originalIncrementRateLimitCounter;
}

function mockBankDetailsModel(overrides) {
  for (const [method, implementation] of Object.entries(overrides)) {
    if (!(method in originalModelMethods)) {
      originalModelMethods[method] = bankDetailsModel[method];
    }

    bankDetailsModel[method] = implementation;
  }
}

function restoreBankDetailsModel() {
  for (const [method, implementation] of Object.entries(originalModelMethods)) {
    bankDetailsModel[method] = implementation;
    delete originalModelMethods[method];
  }
}

function createMockConnection() {
  const calls = {
    begin: 0,
    commit: 0,
    rollback: 0,
    release: 0,
    destroy: 0,
  };

  return {
    calls,

    async beginTransaction() {
      calls.begin++;
    },

    async commit() {
      calls.commit++;
    },

    async rollback() {
      calls.rollback++;
    },

    release() {
      calls.release++;
    },

    destroy() {
      calls.destroy++;
    },
  };
}

function mockValidContext() {
  return {
    async findActiveUserForUpdate() {
      return { id: 52, status: "active" };
    },

    async findCasesByUserIdForUpdate() {
      return [{ id: 13, user_id: 52, status: "pending" }];
    },

    async findKycStepForUpdate(connection, caseId, stepNumber) {
      assert.equal(caseId, 13);
      assert.equal(stepNumber, 3);

      return {
        id: 103,
        status: "completed",
      };
    },

    async findVerifiedPanForUpdate(connection, caseId) {
      assert.equal(caseId, 13);
      return [{ id: 105 }];
    },
  };
}

const sampleBankDetails = {
  ifscCode: "HDFC0001234",
  accountNumber: "123456789012",
};

// ------------------------------------------------------------
// IFSC and IDTO API mocks
// ------------------------------------------------------------

function mockSuccessfulIdtoVerification() {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.IDTO_CLIENT_ID;
  const originalApiKey = process.env.IDTO_API_KEY;
  const originalBaseUrl = process.env.IDTO_BASE_URL;

  process.env.IDTO_CLIENT_ID = "test-client";
  process.env.IDTO_API_KEY = "test-api-key";
  process.env.IDTO_BASE_URL = "https://idto.example";

  globalThis.fetch = async (url, options = {}) => {
    const requestUrl = String(url);

    // Mock IFSC API: fetch bank name using IFSC code.
    if (requestUrl.includes("/api/v1/ifsc/")) {
      assert.match(requestUrl, /HDFC0001234$/);

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            ifsc: "HDFC0001234",
            bank: "HDFC Bank",
          };
        },
      };
    }

    // Mock IDTO API: verify bank account.
    if (requestUrl.endsWith("/v2/verify/bank_verification")) {
      assert.equal(options.method, "POST");

      assert.deepEqual(JSON.parse(options.body), {
        account_number: sampleBankDetails.accountNumber,
        ifsc_code: sampleBankDetails.ifscCode,
      });

      return {
        ok: true,
        status: 200,
        async json() {
          return {
            status: "success",
            tranx_id: "IDTO-TXN-123",
            data: {
              account_holder_name: "Test User",
            },
          };
        },
      };
    }

    throw new Error(`Unexpected API request in test: ${requestUrl}`);
  };

  return () => {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }

    if (originalClientId === undefined) {
      delete process.env.IDTO_CLIENT_ID;
    } else {
      process.env.IDTO_CLIENT_ID = originalClientId;
    }

    if (originalApiKey === undefined) {
      delete process.env.IDTO_API_KEY;
    } else {
      process.env.IDTO_API_KEY = originalApiKey;
    }

    if (originalBaseUrl === undefined) {
      delete process.env.IDTO_BASE_URL;
    } else {
      process.env.IDTO_BASE_URL = originalBaseUrl;
    }
  };
}

// ------------------------------------------------------------
// Service tests
// ------------------------------------------------------------

test("Bank service: saves newly verified bank details", async () => {
  mockBankAttemptCounter();
  const restoreIdto = mockSuccessfulIdtoVerification();
  const connection = createMockConnection();
  let insertedDetails;

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
    },

    async findBankAccountByCaseIdForUpdate() {
      return null;
    },

    async insertBankAccount(conn, caseId, details) {
      insertedDetails = { caseId, ...details };
      return 101;
    },

    async completeStep4() {
      return true;
    },

    async updateCompletedStepsCount() {
      return 1;
    },
  });
const originalConsoleInfo = console.info;
const capturedInfoLogs = [];

console.info = (line) => {
  capturedInfoLogs.push(JSON.parse(line));
};
  try {
    const result = await bankDetailsService.saveBankDetails(
      52,
      sampleBankDetails,
    );

    assert.equal(result.id, 101);
    assert.equal(result.accountHolderName, "Test User");
    assert.equal(result.bankName, "HDFC Bank");
    assert.equal(result.accountNumberLast4, "9012");
    assert.equal(result.verificationStatus, "verified");
    assert.equal(result.stepNumber, 4);
    assert.equal(result.steps_completed, 1);

    assert.equal(insertedDetails.caseId, 13);
    assert.equal(insertedDetails.accountHolderName, "Test User");
    assert.equal(insertedDetails.bankName, "HDFC Bank");
    assert.equal(insertedDetails.providerReference, "IDTO-TXN-123");
    assert.ok(Buffer.isBuffer(insertedDetails.encryptedAccountNumber));
    assert.equal(insertedDetails.accountNumberLast4, "9012");

    assert.equal(connection.calls.begin, 2);
    assert.equal(connection.calls.commit, 2);
    assert.equal(connection.calls.rollback, 0);
    assert.equal(connection.calls.release, 2);
    assert.ok(capturedInfoLogs.some((record) => record.event === "bank.verification_succeeded"));
    const successLog = JSON.stringify(capturedInfoLogs);
    assert.doesNotMatch(successLog, /Test User/);
    assert.doesNotMatch(successLog, /IDTO-TXN-123/);
  } finally {
    restoreIdto();
    restoreBankDetailsModel();
    restoreBankAttemptCounter();
    console.info = originalConsoleInfo;
  }
});

test("Bank service: updates existing bank account", async () => {
  mockBankAttemptCounter();
  const restoreIdto = mockSuccessfulIdtoVerification();
  const connection = createMockConnection();
  let updatedAccountId;
  let updatedCaseId;
  let updatedDetails;

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
    },

    async findBankAccountByCaseIdForUpdate() {
      return { id: 77 };
    },

    async updateBankAccount(conn, accountId, caseId, details) {
      updatedAccountId = accountId;
      updatedCaseId = caseId;
      updatedDetails = details;
    },

    async completeStep4() {
      return true;
    },

    async updateCompletedStepsCount() {
      return 2;
    },
  });

  try {
    const result = await bankDetailsService.saveBankDetails(
      52,
      sampleBankDetails,
    );

    assert.equal(result.id, 77);
    assert.equal(updatedAccountId, 77);
    assert.equal(updatedCaseId, 13);
    assert.equal(updatedDetails.accountHolderName, "Test User");
    assert.equal(updatedDetails.bankName, "HDFC Bank");
    assert.equal(updatedDetails.providerReference, "IDTO-TXN-123");
    assert.equal(updatedDetails.accountNumberLast4, "9012");
    assert.ok(Buffer.isBuffer(updatedDetails.encryptedAccountNumber));

    assert.equal(result.verificationStatus, "verified");
    assert.equal(connection.calls.commit, 2);
    assert.equal(connection.calls.release, 2);
  } finally {
    restoreIdto();
    restoreBankDetailsModel();
    restoreBankAttemptCounter();
  }
});

test("Bank service: retrieves bank details without full account number", async () => {
  mockBankDetailsModel({
    async findActiveUser() {
      return { id: 52, status: "active" };
    },

    async findCurrentCaseByUserId() {
      return { id: 13, user_id: 52, status: "submitted" };
    },

    async findBankAccountByCaseId() {
      return {
        account_holder_name: "Test User",
        bank_name: "Test Bank",
        ifsc_code: "HDFC0001234",
        account_number_last4: "9012",
        verification_status: "verified",
        verified_at: new Date("2026-01-01T00:00:00Z"),
      };
    },
  });

  try {
    const result = await bankDetailsService.getBankDetails(52);

    assert.equal(result.accountHolderName, "Test User");
    assert.equal(result.bankName, "Test Bank");
    assert.equal(result.ifscCode, "HDFC0001234");
    assert.equal(result.accountNumberLast4, "9012");
    assert.equal(result.verificationStatus, "verified");
    assert.equal("accountNumber" in result, false);
    assert.equal("account_number_encrypted" in result, false);

  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rejects inactive users and rolls back", async () => {
  mockBankDetailsModel({
    async findActiveUser() {
      return null;
    },
  });

  try {
    await assert.rejects(
      bankDetailsService.getBankDetails(52),
      (error) => {
        assert.ok(error instanceof ApiError);
        assert.equal(error.code, "UNAUTHORIZED");
        return true;
      },
    );

  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rolls back when database save fails without logging sensitive errors", async () => {
  mockBankAttemptCounter();
  const restoreIdto = mockSuccessfulIdtoVerification();
  const connection = createMockConnection();

  const originalConsoleError = console.error;
  const capturedErrorLogs = [];

  console.error = (line) => {
    capturedErrorLogs.push(JSON.parse(line));
  };

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
    },

    async findBankAccountByCaseIdForUpdate() {
      return null;
    },

    async insertBankAccount() {
      const error = new Error("SECRET_DATABASE_MESSAGE_123");
      error.sqlMessage = "SECRET_SQL_MESSAGE_456";
      throw error;
    },
  });

  try {
    await assert.rejects(
      bankDetailsService.saveBankDetails(52, sampleBankDetails),
      (error) => {
        assert.ok(error instanceof ApiError);
        return true;
      },
    );

    assert.equal(connection.calls.begin, 2);
    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.rollback, 1);
    assert.equal(connection.calls.release, 2);

    // M8: Database and SQL error details must not appear in logs.
    const errorLogs = JSON.stringify(capturedErrorLogs);

    assert.ok(capturedErrorLogs.some((record) => record.event === "bank.operation_failed" && record.operation === "Bank Details save"));
    assert.match(errorLogs, /errorName.*Error/);
    assert.doesNotMatch(errorLogs, /SECRET_DATABASE_MESSAGE_123/);
    assert.doesNotMatch(errorLogs, /SECRET_SQL_MESSAGE_456/);
  } finally {
    console.error = originalConsoleError;
    restoreIdto();
    restoreBankDetailsModel();
    restoreBankAttemptCounter();
  }
});

test("Bank service: does not log sensitive IDTO provider messages", async () => {
  mockBankAttemptCounter();
  const restoreIdto = mockSuccessfulIdtoVerification();
  const connection = createMockConnection();
  const originalConsoleError = console.error;
  const capturedErrorLogs = [];

  console.error = (line) => {
    capturedErrorLogs.push(JSON.parse(line));
  };

  globalThis.fetch = async (url) => {
    const requestUrl = String(url);

    if (requestUrl.includes("/api/v1/ifsc/")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { ifsc: "HDFC0001234", bank: "HDFC Bank" };
        },
      };
    }

    if (requestUrl.endsWith("/v2/verify/bank_verification")) {
      return {
        ok: false,
        status: 502,
        async json() {
          return {
            status: "error",
            error_code: "IDTO_500",
            message: "SECRET_PROVIDER_MESSAGE_123",
          };
        },
      };
    }

    throw new Error(`Unexpected API request: ${requestUrl}`);
  };

  mockBankDetailsModel({
    ...mockValidContext(),
    async getConnection() {
      return connection;
    },
  });

  try {
    await assert.rejects(
      bankDetailsService.saveBankDetails(52, sampleBankDetails),
      (error) => {
        assert.ok(error instanceof ApiError);
        return true;
      },
    );

    const errorLogs = JSON.stringify(capturedErrorLogs);

    assert.ok(capturedErrorLogs.some((record) => record.event === "bank.idto_verification_failed"));
    assert.match(errorLogs, /502/);
    assert.doesNotMatch(errorLogs, /SECRET_PROVIDER_MESSAGE_123/);
  } finally {
    console.error = originalConsoleError;
    restoreIdto();
    restoreBankDetailsModel();
    restoreBankAttemptCounter();
  }
});

test("Bank service: rejects ineligible PAN cases before any paid provider request", async () => {
  const connection = createMockConnection();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error("provider must not be called");
  };
  mockBankDetailsModel({
    async getConnection() { return connection; },
    async findActiveUserForUpdate() { return { id: 52, status: "active" }; },
    async findCasesByUserIdForUpdate() { return [{ id: 13, user_id: 52, status: "pending" }]; },
    async findKycStepForUpdate() { return { id: 103, status: "failed" }; },
    async findVerifiedPanForUpdate() { return [{ id: 105 }]; },
  });

  try {
    await assert.rejects(
      bankDetailsService.saveBankDetails(52, sampleBankDetails),
      (error) => error.code === "PAN_PREREQUISITE_NOT_COMPLETED",
    );
    assert.equal(providerCalls, 0);
    assert.equal(connection.calls.commit, 0);
    assert.equal(connection.calls.rollback, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreBankDetailsModel();
  }
});

test("Bank service: per-case attempt cap blocks provider access and commits the cap", async () => {
  const connection = createMockConnection();
  let providerCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    providerCalls += 1;
    throw new Error("provider must not be called");
  };
  const { getAuthConfig } = await import("../../../config/auth.js");
  const limit = getAuthConfig().rateLimits.bankVerification.case;
  mockBankAttemptCounter(limit + 1);
  mockBankDetailsModel({
    ...mockValidContext(),
    async getConnection() { return connection; },
  });

  try {
    await assert.rejects(
      bankDetailsService.saveBankDetails(52, sampleBankDetails),
      (error) => error.code === "RATE_LIMITED" && error.statusCode === 429,
    );
    assert.equal(providerCalls, 0);
    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.rollback, 0);
  } finally {
    globalThis.fetch = originalFetch;
    restoreBankDetailsModel();
    restoreBankAttemptCounter();
  }
});

// ------------------------------------------------------------
// Model tests
// ------------------------------------------------------------

test("Bank model: locks bank account row using FOR UPDATE", async () => {
  let capturedSql;
  let capturedParams;

  const connection = {
    async execute(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [[{ id: 77 }]];
    },
  };

  const result =
    await bankDetailsModelFunctions.findBankAccountByCaseIdForUpdate(
      connection,
      13,
    );

  assert.equal(result.id, 77);
  assert.match(capturedSql, /FOR UPDATE/i);
  assert.deepEqual(capturedParams, [13]);
});

test("Bank model: retrieves bank account without encrypted number", async () => {
  let capturedSql;

  const connection = {
    async execute(sql) {
      capturedSql = sql;

      return [[{
        account_holder_name: "Test User",
        account_number_last4: "9012",
      }]];
    },
  };

  const result = await bankDetailsModelFunctions.findBankAccountByCaseId(
    connection,
    13,
  );

  assert.equal(result.account_number_last4, "9012");
  assert.doesNotMatch(capturedSql, /account_number_encrypted/i);
});

test("Bank model: inserts verified account with provider reference", async () => {
  let capturedSql;
  let capturedParams;
  const encryptedAccountNumber = Buffer.from("encrypted-data");

  const connection = {
    async execute(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [{ insertId: 101 }];
    },
  };

  const result = await bankDetailsModelFunctions.insertBankAccount(
    connection,
    13,
    {
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      encryptedAccountNumber,
      accountNumberLast4: "9012",
      providerReference: "IDTO-TXN-123",
    },
  );

  assert.equal(result, 101);
  assert.match(capturedSql, /INSERT INTO bank_accounts/i);
  assert.match(capturedSql, /verification_status/i);
  assert.match(capturedSql, /provider_reference/i);
  assert.match(capturedSql, /CURRENT_TIMESTAMP/i);

  assert.deepEqual(capturedParams, [
    13,
    "Test User",
    "Test Bank",
    "HDFC0001234",
    encryptedAccountNumber,
    "9012",
    "IDTO-TXN-123",
  ]);
});

test("Bank model: updates verified account with provider reference", async () => {
  let capturedSql;
  let capturedParams;
  const encryptedAccountNumber = Buffer.from("encrypted-data");

  const connection = {
    async execute(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [{ affectedRows: 1 }];
    },
  };

  const result = await bankDetailsModelFunctions.updateBankAccount(
    connection,
    77,
    13,
    {
      accountHolderName: "Updated User",
      bankName: "Updated Bank",
      ifscCode: "HDFC0001234",
      encryptedAccountNumber,
      accountNumberLast4: "9012",
      providerReference: "IDTO-TXN-456",
    },
  );

  assert.equal(result, true);
  assert.match(capturedSql, /UPDATE bank_accounts/i);
  assert.match(capturedSql, /verification_status\s*=\s*'verified'/i);
  assert.match(capturedSql, /provider_reference\s*=\s*\?/i);
  assert.match(capturedSql, /verified_at\s*=\s*CURRENT_TIMESTAMP/i);

  assert.deepEqual(capturedParams, [
    "Updated User",
    "Updated Bank",
    "HDFC0001234",
    encryptedAccountNumber,
    "9012",
    "IDTO-TXN-456",
    77,
    13,
  ]);
});

test("Bank model: rejects update when no row is affected", async () => {
  const connection = {
    async execute() {
      return [{ affectedRows: 0 }];
    },
  };

  await assert.rejects(
    bankDetailsModelFunctions.updateBankAccount(
      connection,
      77,
      13,
      {
        accountHolderName: "Updated User",
        bankName: "Updated Bank",
        ifscCode: "HDFC0001234",
        encryptedAccountNumber: Buffer.from("encrypted-data"),
        accountNumberLast4: "9012",
        providerReference: "IDTO-TXN-456",
      },
    ),
    /did not affect exactly one row/,
  );
});

test("Bank model: finds active user with parameterized query", async () => {
  let capturedSql;
  let capturedParams;

  const connection = {
    async execute(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [[{ id: 52, status: "active" }]];
    },
  };

  const result = await bankDetailsModelFunctions.findActiveUserForUpdate(
    connection,
    52,
  );

  assert.equal(result.id, 52);
  assert.match(capturedSql, /WHERE id = \?/i);
  assert.match(capturedSql, /FOR UPDATE/i);
  assert.deepEqual(capturedParams, [52]);
});

test("Bank model: retrieves KYC cases with row locking", async () => {
  let capturedSql;
  let capturedParams;

  const connection = {
    async execute(sql, params) {
      capturedSql = sql;
      capturedParams = params;
      return [[{ id: 13, user_id: 52, status: "pending" }]];
    },
  };

  const result = await bankDetailsModelFunctions.findCasesByUserIdForUpdate(
    connection,
    52,
  );

  assert.equal(result.length, 1);
  assert.match(capturedSql, /WHERE user_id = \?/i);
  assert.match(capturedSql, /LIMIT 2/i);
  assert.match(capturedSql, /FOR UPDATE/i);
  assert.deepEqual(capturedParams, [52]);
});
