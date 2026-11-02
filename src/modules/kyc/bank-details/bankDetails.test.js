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

// ============================================================
// TEST ENCRYPTION CONFIGURATION
// ============================================================

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

// ============================================================
// VALIDATION HELPERS
// ============================================================

function runValidator(body) {
  const req = { body };

  validateBankDetails(req, {}, (error) => {
    if (error) throw error;
  });

  return req.validatedBody;
}

// ============================================================
// VALIDATION TESTS
// ============================================================

test("Bank validation: accepts valid bank details", () => {
  const result = runValidator({
    accountHolderName: "Test User",
    bankName: "Test Bank",
    ifscCode: "HDFC0001234",
    accountNumber: "123456789012",
  });

  assert.equal(result.accountHolderName, "Test User");
  assert.equal(result.bankName, "Test Bank");
  assert.equal(result.ifscCode, "HDFC0001234");
  assert.equal(result.accountNumber, "123456789012");
});

test("Bank validation: normalizes IFSC code", () => {
  const result = runValidator({
    accountHolderName: "Test User",
    bankName: "Test Bank",
    ifscCode: "hdfc0001234",
    accountNumber: "123456789012",
  });

  assert.equal(result.ifscCode, "HDFC0001234");
});

test("Bank validation: rejects invalid IFSC code", () => {
  assert.throws(() =>
    runValidator({
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "INVALID123",
      accountNumber: "123456789012",
    }),
  );
});

test("Bank validation: rejects account number shorter than 9 digits", () => {
  assert.throws(() =>
    runValidator({
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "12345678",
    }),
  );
});

test("Bank validation: rejects account number longer than 18 digits", () => {
  assert.throws(() =>
    runValidator({
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "1234567890123456789",
    }),
  );
});

test("Bank validation: rejects alphabetic account numbers", () => {
  assert.throws(() =>
    runValidator({
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "12345ABC9012",
    }),
  );
});

test("Bank validation: rejects unexpected request fields", () => {
  assert.throws(() =>
    runValidator({
      accountHolderName: "Test User",
      bankName: "Test Bank",
      ifscCode: "HDFC0001234",
      accountNumber: "123456789012",
      verificationStatus: "verified",
    }),
  );
});

// ============================================================
// ENCRYPTION TESTS
// ============================================================

test("Bank encryption: encrypts and decrypts account number", () => {
  const accountNumber = "123456789012";

  const encrypted = encryptAccountNumber(accountNumber);

  assert.ok(Buffer.isBuffer(encrypted));
  assert.notEqual(encrypted.toString(), accountNumber);

  const decrypted = decryptAccountNumber(encrypted);

  assert.equal(decrypted, accountNumber);
});

test("Bank encryption: generates different ciphertext for repeated encryption", () => {
  const accountNumber = "123456789012";

  const first = encryptAccountNumber(accountNumber);
  const second = encryptAccountNumber(accountNumber);

  assert.notDeepEqual(first, second);

  assert.equal(decryptAccountNumber(first), accountNumber);
  assert.equal(decryptAccountNumber(second), accountNumber);
});

test("Bank encryption: detects modified encrypted data", () => {
  const encrypted = encryptAccountNumber("123456789012");

  const tampered = Buffer.from(encrypted);
  tampered[tampered.length - 1] ^= 1;

  assert.throws(() => decryptAccountNumber(tampered));
});

// ============================================================
// SERVICE TEST HELPERS
// ============================================================

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
  accountHolderName: "Test User",
  bankName: "Test Bank",
  ifscCode: "HDFC0001234",
  accountNumber: "123456789012",
};

// ============================================================
// SERVICE TESTS
// ============================================================

test("Bank service: saves new bank details", async () => {
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
  });

  try {
    const result = await bankDetailsService.saveBankDetails(
      52,
      sampleBankDetails,
    );

    assert.equal(result.id, 101);
    assert.equal(result.accountNumberLast4, "9012");
    assert.equal(result.verificationStatus, "pending");
    assert.equal(result.stepNumber, 4);

    assert.equal(insertedDetails.caseId, 13);
    assert.ok(Buffer.isBuffer(insertedDetails.encryptedAccountNumber));
    assert.equal(insertedDetails.accountNumberLast4, "9012");

    assert.equal(connection.calls.begin, 1);
    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.rollback, 0);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: updates existing bank details", async () => {
  const connection = createMockConnection();
  let updatedAccountId;
  let updatedDetails;

  mockBankDetailsModel({
    ...mockValidContext(),

    async getConnection() {
      return connection;
    },

    async findBankAccountByCaseIdForUpdate() {
      return { id: 77 };
    },

    async updateBankAccount(conn, accountId, details) {
      updatedAccountId = accountId;
      updatedDetails = details;
    },
  });

  try {
    const result = await bankDetailsService.saveBankDetails(
      52,
      sampleBankDetails,
    );

    assert.equal(result.id, 77);
    assert.equal(updatedAccountId, 77);
    assert.ok(Buffer.isBuffer(updatedDetails.encryptedAccountNumber));
    assert.equal(updatedDetails.accountNumberLast4, "9012");

    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
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
        verification_status: "pending",
        verified_at: null,
        account_number_encrypted: Buffer.from("secret"),
      };
    },
  });

  try {
    const result = await bankDetailsService.getBankDetails(52);

    assert.equal(result.accountHolderName, "Test User");
    assert.equal(result.accountNumberLast4, "9012");
    assert.equal(result.verificationStatus, "pending");

    assert.equal("accountNumber" in result, false);
    assert.equal("account_number_encrypted" in result, false);

    assert.equal(connection.calls.commit, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rejects inactive users and rolls back transaction", async () => {
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
    await assert.rejects(bankDetailsService.getBankDetails(52), (error) => {
      assert.ok(error instanceof ApiError);
      return true;
    });

    assert.equal(connection.calls.commit, 0);
    assert.equal(connection.calls.rollback, 1);
    assert.equal(connection.calls.release, 1);
  } finally {
    restoreBankDetailsModel();
  }
});

test("Bank service: rolls back when database save fails", async () => {
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
    restoreBankDetailsModel();
  }
});

// ============================================================
// DATABASE MODEL TESTS
// ============================================================

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

test("Bank model: retrieves bank account without selecting encrypted account number", async () => {
  let capturedSql;

  const connection = {
    async execute(sql) {
      capturedSql = sql;

      return [
        [
          {
            account_holder_name: "Test User",
            account_number_last4: "9012",
          },
        ],
      ];
    },
  };

  const result = await bankDetailsModelFunctions.findBankAccountByCaseId(
    connection,
    13,
  );

  assert.equal(result.account_number_last4, "9012");
  assert.doesNotMatch(capturedSql, /account_number_encrypted/i);

  assert.deepEqual(result, {
    account_holder_name: "Test User",
    account_number_last4: "9012",
  });
});

test("Bank model: inserts encrypted account number using parameterized SQL", async () => {
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
    },
  );

  assert.equal(result, 101);
  assert.match(capturedSql, /INSERT INTO bank_accounts/i);
  assert.match(capturedSql, /account_number_encrypted/i);
  assert.match(capturedSql, /verification_status/i);

  assert.deepEqual(capturedParams, [
    13,
    "Test User",
    "Test Bank",
    "HDFC0001234",
    encryptedAccountNumber,
    "9012",
  ]);

  assert.ok(Buffer.isBuffer(capturedParams[4]));
});

test("Bank model: updates bank details and resets verification status", async () => {
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
    {
      accountHolderName: "Updated User",
      bankName: "Updated Bank",
      ifscCode: "HDFC0001234",
      encryptedAccountNumber,
      accountNumberLast4: "9012",
    },
  );

  assert.equal(result, true);
  assert.match(capturedSql, /UPDATE bank_accounts/i);
  assert.match(capturedSql, /verification_status\s*=\s*'pending'/i);
  assert.match(capturedSql, /provider_reference\s*=\s*NULL/i);
  assert.match(capturedSql, /verified_at\s*=\s*NULL/i);

  assert.deepEqual(capturedParams, [
    "Updated User",
    "Updated Bank",
    "HDFC0001234",
    encryptedAccountNumber,
    "9012",
    77,
  ]);
});

test("Bank model: uses parameterized query when finding active user", async () => {
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

test("Bank model: retrieves KYC cases using parameterized query and row locking", async () => {
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
