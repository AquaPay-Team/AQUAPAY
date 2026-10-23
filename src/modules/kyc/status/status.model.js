import pool from "../../../config/db.js";

async function findCaseByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT id, user_id, status, current_step, submitted_at, reviewed_at, created_at, updated_at
       FROM kyc_cases
      WHERE user_id = ?
      LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function findStepsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT step_number, status, completed_at
       FROM kyc_steps
      WHERE case_id = ?
      ORDER BY step_number ASC`,
    [caseId],
  );
  return rows;
}

const statusModel = {
  findCaseByUserId,
  findStepsByCaseId,
};

export { findCaseByUserId, findStepsByCaseId };
export default statusModel;
