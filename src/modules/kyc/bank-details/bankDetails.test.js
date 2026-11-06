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
    bankName: "Test Bank",
    ifscCode: "HDFC0001234",
    accountNumber: "123456789012",
  });

  assert.deepEqual(result, {
    bankName: "Test Bank",
    ifscCode: "HDFC0001234",
    accountNumber: "123456789012",
  });
});

test("Bank validation: normalizes IFSC code", () => {
  const result = runValidator({
    bankName: "Test Bank",
    ifscCode: "hdfc0001234",
    accountNumber: "123456789012",
  });

  assert.equal(result.ifscCode, "HDFC0001234");
});

test("Bank validation: rejects invalid IFSC", () => {
  assert.throws(() =>
    runValidator({
      bankName: "Test Bank",
      ifscCode: "INVALID123",
      accountNumber: "123456789012",
    }),
  );
});

test("Bank validation: rejects account number shorter than 9 digits", () => {
  assert.throws(() =>
    runValidator({
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "12345678",
    }),
  );
});

test("Bank validation: rejects account number longer than 18 digits", () => {
  assert.throws(() =>
    runValidator({
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "1234567890123456789",
    }),
  );
});

test("Bank validation: rejects non-numeric account number", () => {
  assert.throws(() =>
    runValidator({
      bankName: "Test Bank",
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
  };
}

const sampleBankDetails = {
  bankName: "Test Bank",
  ifscCode: "HDFC0001234",
  accountNumber: "123456789012",
};

function mockSuccessfulIdtoVerification() {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.IDTO_CLIENT_ID;
  const originalApiKey = process.env.IDTO_API_KEY;
  const originalBaseUrl = process.env.IDTO_BASE_URL;

  process.env.IDTO_CLIENT_ID = "test-client";
  process.env.IDTO_API_KEY = "test-api-key";
  process.env.IDTO_BASE_URL = "https://idto.example";

  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /\/v2\/verify\/bank_verification$/);
    assert.equal(options.method, "POST");

    assert.deepEqual(JSON.parse(options.body), {
      account_number: sampleBankDetails.accountNumber,
      ifsc_code: sampleBankDetails.ifscCode,
    });

    return {
      ok: true,
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

  try {
    const result = await bankDetailsService.saveBankDetails(
      52,
      sampleBankDetails,
    );

    assert.equal(result.id, 101);
    assert.equal(result.accountHolderName, "Test User");
    assert.equal(result.accountNumberLast4, "9012");
    assert.equal(result.verificationStatus, "verified");
    assert.equal(result.stepNumber, 4);
    assert.equal(result.steps_completed, 1);

    assert.equal(insertedDetails.caseId, 13);
    assert.equal(insertedDetails.accountHolderName, "Test User");
    assert.equal(insertedDetails.providerReference, "IDTO-TXN-123");
    assert.ok(Buffer.isBuffer(insertedDetails.encryptedAccountNumber));
    assert.equal(insertedDetails.accountNumberLast4, "9012");

    assert.equal(connection.calls.begin, 1);
    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.rollback, 0);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreIdto();
    restoreBankDetailsModel();
  }
});

test("Bank service: updates existing bank account", async () => {
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
    assert.equal(updatedDetails.providerReference, "IDTO-TXN-123");
    assert.equal(updatedDetails.accountNumberLast4, "9012");
    assert.ok(Buffer.isBuffer(updatedDetails.encryptedAccountNumber));

    assert.equal(result.verificationStatus, "verified");
    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreIdto();
    restoreBankDetailsModel();
  }
});

test("Bank service: retrieves bank details without full account number", async () => {
  const connection = createMockConnection();

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
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

    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rejects inactive users and rolls back", async () => {
  const connection = createMockConnection();

  mockBankDetailsModel({
    async getConnection() {
      return connection;
    },

    async findActiveUserForUpdate() {
      return { id: 52, status: "inactive" };
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

    assert.equal(connection.calls.commit, 0);
    assert.equal(connection.calls.rollback, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rolls back when database save fails", async () => {
  const restoreIdto = mockSuccessfulIdtoVerification();
  const connection = createMockConnection();

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
    },

    async findBankAccountByCaseIdForUpdate() {
      return null;
    },

    async insertBankAccount() {
      throw new Error("Database failure");
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

    assert.equal(connection.calls.commit, 0);
    assert.equal(connection.calls.rollback, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreIdto();
    restoreBankDetailsModel();
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