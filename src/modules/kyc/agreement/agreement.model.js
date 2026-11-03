import pool from "../../../config/db.js";

const getDb = (db) => (db && typeof db.execute === "function" ? db : pool);

async function getConnection() {
  return pool.getConnection();
}

async function findActiveUserForUpdate(connection, userId) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.shopname, u.address, u.state, u.city, u.pincode,
            u.status, u.role_id, r.name AS role_name, r.slug AS role_slug
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
    `SELECT u.id, u.name, u.email, u.mobile, u.shopname, u.address, u.state, u.city, u.pincode,
            u.status, u.role_id, r.name AS role_name, r.slug AS role_slug
       FROM users u
       JOIN roles r ON r.id = u.role_id
      WHERE u.id = ? AND u.status = 'active'
      LIMIT 1`,
    [userId],
  );

  return rows[0] || null;
}

async function findCasesByUserIdForUpdate(connection, userId) {
  const [rows] = await getDb(connection).execute(
    `SELECT id, user_id, status, steps_completed, business_type
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      FOR UPDATE`,
    [userId],
  );

  return rows;
}

async function findCasesByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, status, steps_completed, business_type
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC`,
    [userId],
  );

  return rows;
}

async function findStepByCaseIdAndNumber(db, caseId, stepNumber) {
  const [rows] = await getDb(db).execute(
    `SELECT id, case_id, step_number, status, completed_at
       FROM kyc_steps
      WHERE case_id = ? AND step_number = ?
      LIMIT 1`,
    [caseId, stepNumber],
  );

  return rows[0] || null;
}

async function findAgreementAcceptance(db, caseId, agreementCode, agreementVersion) {
  const [rows] = await getDb(db).execute(
    `SELECT id, case_id, agreement_code, agreement_version, accepted_at
       FROM agreement_acceptances
      WHERE case_id = ? AND agreement_code = ? AND agreement_version = ?
      LIMIT 1`,
    [caseId, agreementCode, agreementVersion],
  );

  return rows[0] || null;
}

async function findLatestAgreementAcceptance(db, caseId) {
  const [rows] = await getDb(db).execute(
    `SELECT id, case_id, agreement_code, agreement_version, accepted_at
       FROM agreement_acceptances
      WHERE case_id = ?
      ORDER BY accepted_at DESC, id DESC
      LIMIT 1`,
    [caseId],
  );

  return rows[0] || null;
}

async function insertAgreementAcceptance(
  connection,
  { caseId, agreementCode, agreementVersion, acceptedAt },
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO agreement_acceptances (case_id, agreement_code, agreement_version, accepted_at)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE accepted_at = VALUES(accepted_at)`,
    [caseId, agreementCode, agreementVersion, acceptedAt],
  );

  return result.insertId || result.affectedRows > 0;
}

async function completeStep6(connection, caseId) {
  const [result] = await getDb(connection).execute(
    `UPDATE kyc_steps
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 6
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

const agreementModel = {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCasesByUserId,
  findStepByCaseIdAndNumber,
  findAgreementAcceptance,
  findLatestAgreementAcceptance,
  insertAgreementAcceptance,
  completeStep6,
  updateCompletedStepsCount,
};

export {
  getConnection,
  findActiveUserForUpdate,
  findActiveUser,
  findCasesByUserIdForUpdate,
  findCasesByUserId,
  findStepByCaseIdAndNumber,
  findAgreementAcceptance,
  findLatestAgreementAcceptance,
  insertAgreementAcceptance,
  completeStep6,
  updateCompletedStepsCount,
};

export default agreementModel;
