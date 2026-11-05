import pool from "../../../config/db.js";
import { DEVELOPMENT_ONLY_PROVIDER_NAMES } from "../document-verification/digilocker/digilocker.model.js";

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

async function findDevelopmentUnverifiedVerificationsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT verification_type
       FROM kyc_verifications
      WHERE case_id = ?
        AND provider IN (?, ?)
        AND status = 'verified'
      ORDER BY verification_type ASC`,
    [caseId, ...DEVELOPMENT_ONLY_PROVIDER_NAMES],
  );
  return rows;
}

const statusModel = {
  findCasesByUserId,
  findStepsByCaseId,
  findDevelopmentUnverifiedVerificationsByCaseId,
};

export {
  findCasesByUserId,
  findStepsByCaseId,
  findDevelopmentUnverifiedVerificationsByCaseId,
};
export default statusModel;
