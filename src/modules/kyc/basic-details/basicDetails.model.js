import pool from "../../../config/db.js";

async function getConnection() {
  return await pool.getConnection();
}

async function findUserById(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, name, email, mobile, status
       FROM users
      WHERE id = ?
      FOR UPDATE`,
    [userId],
  );
  return rows[0] || null;
}

async function findCaseByUserId(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, business_type, status, current_step, created_at, updated_at
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 1
      FOR UPDATE`,
    [userId],
  );
  return rows[0] || null;
}

async function createCase(connection, { userId, businessType }) {
  const [result] = await connection.execute(
    `INSERT INTO kyc_cases (user_id, business_type, status, current_step)
     VALUES (?, ?, 'draft', 1)`,
    [userId, businessType],
  );
  return result.insertId;
}

async function updateCaseBusinessType(connection, caseId, businessType) {
  await connection.execute(
    `UPDATE kyc_cases
        SET business_type = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [businessType, caseId],
  );
}

async function findStepsByCaseId(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT step_number, status, completed_at
       FROM kyc_steps
      WHERE case_id = ?
      ORDER BY step_number ASC`,
    [caseId],
  );
  return rows;
}

async function insertStep(connection, { caseId, stepNumber, status, completedAt = null }) {
  await connection.execute(
    `INSERT INTO kyc_steps (case_id, step_number, status, completed_at)
     VALUES (?, ?, ?, ?)`,
    [caseId, stepNumber, status, completedAt],
  );
}

async function updateStep(connection, { caseId, stepNumber, status, completedAt = null }) {
  await connection.execute(
    `UPDATE kyc_steps
        SET status = ?,
            completed_at = COALESCE(completed_at, ?),
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = ?`,
    [status, completedAt, caseId, stepNumber],
  );
}

async function updateUserAddress(connection, userId, { shopAddress, city, pincode }) {
  await connection.execute(
    `UPDATE users
        SET address = ?,
            city = ?,
            pincode = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [shopAddress, city, pincode, userId],
  );
}

const basicDetailsModel = {
  getConnection,
  findUserById,
  findCaseByUserId,
  createCase,
  updateCaseBusinessType,
  findStepsByCaseId,
  insertStep,
  updateStep,
  updateUserAddress,
};

export {
  getConnection,
  findUserById,
  findCaseByUserId,
  createCase,
  updateCaseBusinessType,
  findStepsByCaseId,
  insertStep,
  updateStep,
  updateUserAddress,
};

export default basicDetailsModel;
