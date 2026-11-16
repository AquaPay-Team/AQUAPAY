import pool from "../../../config/db.js";

/**
 * Fetch KYC applications with pagination and status filtering.
 *
 * @param {Object} options
 * @param {string[]} options.statuses
 * @param {number} options.limit
 * @param {number} options.offset
 */
async function findKycApplications({ statuses, limit, offset }) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error("At least one KYC status is required");
  }

  const placeholders = statuses.map(() => "?").join(", ");

  const [rows] = await pool.execute(
    `SELECT
       kc.id AS case_id,
       u.id AS user_id,
       u.name,
       u.email,
       u.mobile,
       u.status AS user_status,
       kc.status AS kyc_status,
       kc.submitted_at,
       kc.reviewed_at,
       kc.created_at
     FROM kyc_cases kc
     INNER JOIN users u ON u.id = kc.user_id
     WHERE kc.status IN (${placeholders})
     ORDER BY kc.submitted_at DESC, kc.id DESC
     LIMIT ? OFFSET ?`,
    [...statuses, limit, offset],
  );

  return rows;
}

/**
 * Count KYC applications matching the selected statuses.
 *
 * @param {string[]} statuses
 */
async function countKycApplications(statuses) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error("At least one KYC status is required");
  }

  const placeholders = statuses.map(() => "?").join(", ");

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM kyc_cases
     WHERE status IN (${placeholders})`,
    statuses,
  );

  return Number(rows[0].total);
}

/**
 * Fetch one KYC application with applicant details.
 *
 * Only safe applicant and case fields are selected.
 */
async function findKycCaseById(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       kc.id AS case_id,
       kc.user_id,
       kc.business_type,
       kc.status AS kyc_status,
       kc.steps_completed,
       kc.submitted_at,
       kc.reviewed_at,
       kc.rejection_reason,
       kc.created_at,
       kc.updated_at,
       u.name,
       u.email,
       u.mobile,
       u.status AS user_status,
       u.address,
       u.city,
       u.pincode
     FROM kyc_cases kc
     INNER JOIN users u ON u.id = kc.user_id
     WHERE kc.id = ?
     LIMIT 1`,
    [caseId],
  );

  return rows[0] || null;
}

/**
 * Fetch completion status of all KYC steps.
 */
async function findKycStepsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       step_number,
       status,
       completed_at,
       failure_code
     FROM kyc_steps
     WHERE case_id = ?
     ORDER BY step_number ASC`,
    [caseId],
  );

  return rows;
}

/**
 * Fetch Aadhaar and PAN verification summaries.
 *
 * Does not retrieve encrypted identity payloads.
 */
async function findVerificationsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       verification_type,
       provider,
       status,
       masked_identifier,
       verified_name,
       failure_code,
       verified_at
     FROM kyc_verifications
     WHERE case_id = ?
     ORDER BY id ASC`,
    [caseId],
  );

  return rows;
}

/**
 * Fetch safe bank account details.
 *
 * Never retrieve the encrypted account number or provider reference.
 */
async function findBankDetailsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       account_holder_name,
       bank_name,
       ifsc_code,
       account_number_last4,
       verification_status,
       verified_at
     FROM bank_accounts
     WHERE case_id = ?
     LIMIT 1`,
    [caseId],
  );

  return rows[0] || null;
}

/**
 * Fetch uploaded document metadata.
 *
 * Never expose storage_key or private storage URLs.
 */
async function findMediaDetailsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       asset_type,
       mime_type,
       file_size_bytes,
       status,
       created_at
     FROM media_assets
     WHERE case_id = ?
     ORDER BY created_at DESC, id DESC`,
    [caseId],
  );

  return rows;
}


/**
 * Find one media asset for secure admin document access.
 * Internal use only: never return storage details in the API response.
 */
async function findMediaAssetForAdmin(caseId, assetId) {
  const [rows] = await pool.execute(
    `SELECT
       id,
       case_id,
       asset_type,
       storage_provider,
       storage_key,
       mime_type,
       status
     FROM media_assets
     WHERE case_id = ? AND id = ?
     LIMIT 1`,
    [caseId, assetId],
  );

  return rows[0] || null;
}


/**
 * Fetch agreement acceptance records.
 */
async function findAgreementsByCaseId(caseId) {
  const [rows] = await pool.execute(
    `SELECT
       agreement_code,
       agreement_version,
       accepted_at
     FROM agreement_acceptances
     WHERE case_id = ?
     ORDER BY accepted_at DESC`,
    [caseId],
  );

  return rows;
}

const adminKycModel = {
  findKycApplications,
  countKycApplications,
  findKycCaseById,
  findKycStepsByCaseId,
  findVerificationsByCaseId,
  findBankDetailsByCaseId,
  findMediaDetailsByCaseId,
  findMediaAssetForAdmin,
  findAgreementsByCaseId,
};

export {
  findKycApplications,
  countKycApplications,
  findKycCaseById,
  findKycStepsByCaseId,
  findVerificationsByCaseId,
  findBankDetailsByCaseId,
  findMediaDetailsByCaseId,
  findMediaAssetForAdmin,
  findAgreementsByCaseId,
};

export default adminKycModel;
