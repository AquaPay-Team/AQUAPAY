import pool from "../../../config/db.js";

async function findCasesByUserId(userId) {
  const [rows] = await pool.execute(
    `SELECT id, status, steps_completed, business_type
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 2`,
    [userId],
  );
  return rows;
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

const statusModel = { findCasesByUserId, findStepsByCaseId };

export { findCasesByUserId, findStepsByCaseId };
export default statusModel;
