import pool from "../../../config/db.js";

async function findCasesByUserId(userId) {
  const [activeRows] = await pool.execute(
    `SELECT id, status, steps_completed, business_type
       FROM kyc_cases
      WHERE user_id = ?
        AND status IN ('draft', 'pending', 'submitted', 'under_review')
      ORDER BY id DESC
      LIMIT 2`,
    [userId],
  );
  if (activeRows.length > 0) return activeRows;

  const [closedRows] = await pool.execute(
    `SELECT id, status, steps_completed, business_type
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id DESC
      LIMIT 1`,
    [userId],
  );
  return closedRows;
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

async function findDevelopmentUnverifiedSteps(caseId) {
  const [rows] = await pool.execute(
    `SELECT DISTINCT CASE verification_type
              WHEN 'aadhaar' THEN 2
              WHEN 'pan' THEN 3
            END AS step_number
       FROM kyc_verifications
      WHERE case_id = ?
        AND status = 'verified'
        AND provider IN ('idto_digilocker_v1_dev_unverified', 'idto_pan_detailed_v2_mock')
      ORDER BY step_number ASC`,
    [caseId],
  );
  return rows.map((row) => Number(row.step_number)).filter(Number.isInteger);
}

const statusModel = {
  findCasesByUserId,
  findStepsByCaseId,
  findDevelopmentUnverifiedSteps,
};

export {
  findCasesByUserId,
  findStepsByCaseId,
  findDevelopmentUnverifiedSteps,
};

export default statusModel;
