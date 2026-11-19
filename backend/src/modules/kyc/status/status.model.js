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

/**
 * Read only the verified Aadhaar display fields for this case.
 * The service obtains caseId from the authenticated user's own KYC case.
 */
async function findVerifiedAadhaarByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT v.masked_identifier, v.verified_name
       FROM kyc_verifications v
       INNER JOIN kyc_steps s
         ON s.case_id = v.case_id AND s.step_number = 2
      WHERE v.case_id = ?
        AND v.verification_type = 'aadhaar'
        AND v.status = 'verified'
        AND s.status = 'completed'
      ORDER BY v.id ASC
      LIMIT 2`,
    [caseId],
  );
  return rows;
}

/** Read only the previously verified PAN display fields for this merchant case. */
async function findVerifiedPanByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT v.masked_identifier, v.verified_name
       FROM kyc_verifications v
       INNER JOIN kyc_steps s
         ON s.case_id = v.case_id AND s.step_number = 3
      WHERE v.case_id = ?
        AND v.verification_type = 'pan'
        AND v.status = 'verified'
        AND s.status = 'completed'
      ORDER BY v.id ASC
      LIMIT 2`,
    [caseId],
  );
  return rows;
}

const statusModel = {
  findCasesByUserId,
  findStepsByCaseId,
  findVerifiedAadhaarByCaseId,
  findVerifiedPanByCaseId,
};

export {
  findCasesByUserId,
  findStepsByCaseId,
  findVerifiedAadhaarByCaseId,
  findVerifiedPanByCaseId,
};

export default statusModel;
