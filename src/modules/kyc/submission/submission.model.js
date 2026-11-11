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
  const [rows] = await getDb(connection).execute(
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
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
    `SELECT id, user_id, status, steps_completed, business_type, submitted_at, reviewed_at, rejection_reason
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC`,
    [userId],
  );

  return rows;
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
  submitKycCase,
  completeStep7,
  updateCompletedStepsCount,
  insertStatusHistory,
};

export default submissionModel;

