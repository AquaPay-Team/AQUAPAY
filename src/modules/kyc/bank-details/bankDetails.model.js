import pool from "../../../config/db.js";

async function getConnection() {
  return pool.getConnection();
}

async function findActiveUserForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, status
       FROM users
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
    [userId],
  );

  return rows[0] || null;
}

async function findCasesByUserIdForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, status, steps_completed
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE`,
    [userId],
  );

  return rows;
}

async function findBankAccountByCaseIdForUpdate(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT id, account_holder_name, bank_name, ifsc_code,
            account_number_last4, verification_status,
            verified_at, created_at, updated_at
       FROM bank_accounts
      WHERE case_id = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId],
  );

  return rows[0] || null;
}

async function findBankAccountByCaseId(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT account_holder_name, bank_name, ifsc_code,
            account_number_last4, verification_status,
            verified_at, created_at, updated_at
       FROM bank_accounts
      WHERE case_id = ?
      LIMIT 1`,
    [caseId],
  );

  return rows[0] || null;
}

async function insertBankAccount(connection, caseId, bankDetails) {
  const [result] = await connection.execute(
    `INSERT INTO bank_accounts (
       case_id,
       account_holder_name,
       bank_name,
       ifsc_code,
       account_number_encrypted,
       account_number_last4,
       verification_status
     ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      caseId,
      bankDetails.accountHolderName,
      bankDetails.bankName,
      bankDetails.ifscCode,
      bankDetails.encryptedAccountNumber,
      bankDetails.accountNumberLast4,
    ],
  );

  return Number(result.insertId);
}

async function updateBankAccount(connection, accountId, bankDetails) {
  await connection.execute(
    `UPDATE bank_accounts
        SET account_holder_name = ?,
            bank_name = ?,
            ifsc_code = ?,
            account_number_encrypted = ?,
            account_number_last4 = ?,
            verification_status = 'pending',
            provider_reference = NULL,
            verified_at = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      bankDetails.accountHolderName,
      bankDetails.bankName,
      bankDetails.ifscCode,
      bankDetails.encryptedAccountNumber,
      bankDetails.accountNumberLast4,
      accountId,
    ],
  );

  return true;
}

export {
  getConnection,
  findActiveUserForUpdate,
  findCasesByUserIdForUpdate,
  findBankAccountByCaseIdForUpdate,
  findBankAccountByCaseId,
  insertBankAccount,
  updateBankAccount,
};

export default {
  getConnection,
  findActiveUserForUpdate,
  findCasesByUserIdForUpdate,
  findBankAccountByCaseIdForUpdate,
  findBankAccountByCaseId,
  insertBankAccount,
  updateBankAccount,
};
