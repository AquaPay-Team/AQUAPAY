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

async function findActiveUser(userId) {
  const [rows] = await pool.execute(
    `SELECT id, status
       FROM users
      WHERE id = ? AND status = 'active'
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function findCasesByUserIdForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, status, steps_completed
       FROM kyc_cases
      WHERE user_id = ?
        AND status IN ('draft', 'pending', 'submitted', 'under_review')
      ORDER BY id DESC
      LIMIT 2
      FOR UPDATE`,
    [userId],
  );

  return rows;
}

async function findCurrentCaseByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, status, steps_completed
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY CASE WHEN status IN ('draft', 'pending', 'submitted', 'under_review') THEN 0 ELSE 1 END,
               id DESC
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function findKycStepForUpdate(connection, caseId, stepNumber) {
  const [rows] = await connection.execute(
    `SELECT id, status
       FROM kyc_steps
      WHERE case_id = ? AND step_number = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId, stepNumber],
  );
  return rows[0] || null;
}

async function findVerifiedPanForUpdate(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT id
       FROM kyc_verifications
      WHERE case_id = ?
        AND verification_type = 'pan'
        AND status = 'verified'
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE`,
    [caseId],
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
  const db = connection && typeof connection.execute === "function" ? connection : pool;
  const [rows] = await db.execute(
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
       verification_status,
       provider_reference,
       verified_at
     ) VALUES (?, ?, ?, ?, ?, ?, 'verified', ?, CURRENT_TIMESTAMP)`,
    [
      caseId,
      bankDetails.accountHolderName,
      bankDetails.bankName,
      bankDetails.ifscCode,
      bankDetails.encryptedAccountNumber,
      bankDetails.accountNumberLast4,
      bankDetails.providerReference ?? null,
    ],
  );

  return Number(result.insertId);
}

async function updateBankAccount(
  connection,
  accountId,
  caseId,
  bankDetails,
) {
  const [result] = await connection.execute(
    `UPDATE bank_accounts
        SET account_holder_name = ?,
            bank_name = ?,
            ifsc_code = ?,
            account_number_encrypted = ?,
            account_number_last4 = ?,
            verification_status = 'verified',
            provider_reference = ?,
            verified_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND case_id = ?`,
    [
      bankDetails.accountHolderName,
      bankDetails.bankName,
      bankDetails.ifscCode,
      bankDetails.encryptedAccountNumber,
      bankDetails.accountNumberLast4,
      bankDetails.providerReference ?? null,
      accountId,
      caseId,
    ],
  );

  if (result.affectedRows !== 1) {
    throw new Error("Bank account update did not affect exactly one row");
  }

  return true;
}

async function completeStep4(connection, caseId) {
  await connection.execute(
    `UPDATE kyc_steps
        SET status = 'completed',
            completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 4`,
    [caseId],
  );

  const [rows] = await connection.execute(
    `SELECT status
       FROM kyc_steps
      WHERE case_id = ?
        AND step_number = 4
      LIMIT 1`,
    [caseId],
  );

  return rows[0]?.status === "completed";
}

async function updateCompletedStepsCount(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS steps_completed
       FROM kyc_steps
      WHERE case_id = ?
        AND status = 'completed'`,
    [caseId],
  );

  const stepsCompleted = Number(rows[0]?.steps_completed || 0);

  await connection.execute(
    `UPDATE kyc_cases
        SET steps_completed = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [stepsCompleted, caseId],
  );

  return stepsCompleted;
}

export {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCurrentCaseByUserId,
  findKycStepForUpdate,
  findVerifiedPanForUpdate,
  findBankAccountByCaseIdForUpdate,
  findBankAccountByCaseId,
  insertBankAccount,
  updateBankAccount,
  completeStep4,
  updateCompletedStepsCount,
};

export default {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCurrentCaseByUserId,
  findKycStepForUpdate,
  findVerifiedPanForUpdate,
  findBankAccountByCaseIdForUpdate,
  findBankAccountByCaseId,
  insertBankAccount,
  updateBankAccount,
  completeStep4,
  updateCompletedStepsCount,
};
