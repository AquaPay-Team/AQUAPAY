import pool from "../../../config/db.js";

const getDb = (db) => (db && typeof db.execute === "function" ? db : pool);

async function getConnection() {
  return pool.getConnection();
}

async function findActiveUserForUpdate(connection, userId) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.status, u.role_id,
            r.name AS role_name, r.slug AS role_slug
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.status = 'active'
      LIMIT 1
      FOR UPDATE`,
    [userId],
  );

  return rows[0] || null;
}

async function findActiveUser(userId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.status, u.role_id,
            r.name AS role_name, r.slug AS role_slug
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.status = 'active'
      LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function findCasesByUserIdForUpdate(connection, userId) {
  const db = getDb(connection);
  const [activeRows] = await db.execute(
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
       FROM kyc_cases
      WHERE user_id = ?
        AND status IN ('draft', 'pending', 'submitted', 'under_review')
      ORDER BY id DESC
      LIMIT 2
      FOR UPDATE`,
    [userId],
  );
  if (activeRows.length > 0) return activeRows;
  const [closedRows] = await db.execute(
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1
      FOR UPDATE`,
    [userId],
  );
  return closedRows;
}

async function findCasesByUserId(userId) {
  const [activeRows] = await pool.execute(
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
       FROM kyc_cases
      WHERE user_id = ?
        AND status IN ('draft', 'pending', 'submitted', 'under_review')
      ORDER BY id DESC
      LIMIT 2`,
    [userId],
  );
  if (activeRows.length > 0) return activeRows;
  const [closedRows] = await pool.execute(
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [userId],
  );
  return closedRows;
}

async function findStepsByCaseId(db, caseId) {
  const [rows] = await getDb(db).execute(
    `SELECT id, case_id, step_number, status, completed_at, failure_code
       FROM kyc_steps
      WHERE case_id = ?
      ORDER BY step_number ASC`,
    [caseId],
  );

  return rows;
}

async function findSubmissionEvidence(db, userId, caseId, agreementCode, agreementVersion) {
  const connection = getDb(db);
  const [basicDetailsRows] = await connection.execute(
    `SELECT kc.business_type, u.address, u.city, u.pincode
       FROM kyc_cases kc
       JOIN users u ON u.id = kc.user_id
      WHERE kc.id = ? AND kc.user_id = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId, userId],
  );
  const [verificationRecords] = await connection.execute(
    `SELECT verification.verification_type,
            verification.provider,
            verification.verified_name,
            verification.masked_identifier,
            CASE
              WHEN identity_data.id IS NOT NULL
               AND OCTET_LENGTH(identity_data.payload_ciphertext) > 0
               AND identity_data.payload_iv IS NOT NULL
               AND identity_data.payload_authentication_tag IS NOT NULL
               AND identity_data.encryption_key_version > 0
              THEN 1 ELSE 0
            END AS has_encrypted_identity
       FROM kyc_verifications verification
       JOIN kyc_cases verification_case
         ON verification_case.id = verification.case_id
        AND verification_case.user_id = ?
       LEFT JOIN kyc_identity_data identity_data
         ON identity_data.verification_id = verification.id
        AND identity_data.case_id = verification.case_id
        AND identity_data.user_id = verification_case.user_id
        AND identity_data.identity_type = verification.verification_type
      WHERE verification.case_id = ?
        AND verification.status = 'verified'
        AND (
          (verification.verification_type = 'aadhaar' AND verification.provider = 'idto_digilocker_v1')
          OR
          (verification.verification_type = 'pan' AND verification.provider = 'idto_pan_detailed_v2')
        )
      FOR UPDATE`,
    [userId, caseId],
  );
  const [bankRows] = await connection.execute(
    `SELECT id, verification_status, account_number_encrypted
       FROM bank_accounts
      WHERE case_id = ?
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE`,
    [caseId],
  );
  const [mediaRows] = await connection.execute(
    `SELECT asset_type, status
       FROM media_assets current_asset
      WHERE current_asset.case_id = ?
        AND current_asset.asset_type IN ('shop_image', 'selfie', 'consent_video')
        AND NOT EXISTS (
          SELECT 1 FROM media_assets newer
           WHERE newer.case_id = current_asset.case_id
             AND newer.asset_type = current_asset.asset_type
             AND newer.id > current_asset.id
        )
      FOR UPDATE`,
    [caseId],
  );
  const [agreementRows] = await connection.execute(
    `SELECT id
       FROM agreement_acceptances
      WHERE case_id = ?
        AND agreement_code = ?
        AND agreement_version = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId, agreementCode, agreementVersion],
  );

  return {
    basicDetails: basicDetailsRows[0] || null,
    verificationRecords,
    bankAccounts: bankRows,
    latestMedia: mediaRows,
    agreementAcceptance: agreementRows[0] || null,
  };
}

async function submitKycCase(connection, caseId, submittedAt) {
  const [result] = await getDb(connection).execute(
    `UPDATE kyc_cases
        SET status = 'submitted',
            submitted_at = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [submittedAt, caseId],
  );

  return Number(result.affectedRows || 0) === 1;
}

async function completeStep7(connection, caseId) {
  const [result] = await getDb(connection).execute(
    `UPDATE kyc_steps
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 7
        AND status <> 'completed'`,
    [caseId],
  );

  return Number(result.affectedRows || 0) === 1;
}

async function updateCompletedStepsCount(connection, caseId) {
  const [rows] = await getDb(connection).execute(
    `SELECT COUNT(*) AS steps_completed
       FROM kyc_steps
      WHERE case_id = ?
        AND status = 'completed'`,
    [caseId],
  );

  const stepsCompleted = Number(rows[0]?.steps_completed || 0);

  await getDb(connection).execute(
    `UPDATE kyc_cases
        SET steps_completed = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [stepsCompleted, caseId],
  );

  return stepsCompleted;
}

async function insertStatusHistory(
  connection,
  { caseId, oldStatus, newStatus, actorUserId, reason },
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO kyc_status_history (case_id, old_status, new_status, actor_user_id, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [caseId, oldStatus, newStatus, actorUserId, reason || null],
  );

  return result.insertId;
}

const submissionModel = {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCasesByUserId,
  findStepsByCaseId,
  findSubmissionEvidence,
  submitKycCase,
  completeStep7,
  updateCompletedStepsCount,
  insertStatusHistory,
};

export {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCasesByUserId,
  findStepsByCaseId,
  findSubmissionEvidence,
  submitKycCase,
  completeStep7,
  updateCompletedStepsCount,
  insertStatusHistory,
};

export default submissionModel;

