
import pool from "../../../config/db.js";

/**
 * Fetch KYC applications with pagination, status, search and submission-date filtering.
 * Search matches case ID, user ID, name, email and mobile across all records.
 */
async function findKycApplications({ statuses, limit, offset, search, submittedFrom, submittedTo }) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error("At least one KYC status is required");
  }

  const conditions = [`kc.status IN (${statuses.map(() => "?").join(", ")})`];
  const params = [...statuses];

  if (search) {
    conditions.push(`(kc.id = ? OR kc.user_id = ? OR u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`);
    const numeric = /^\d+$/.test(search) ? Number(search) : null;
    const like = `%${search}%`;
    params.push(numeric, numeric, like, like, like);
  }

  if (submittedFrom) {
    conditions.push("kc.submitted_at >= ?");
    params.push(submittedFrom);
  }
  if (submittedTo) {
    conditions.push("kc.submitted_at < ?");
    params.push(submittedTo);
  }

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
      WHERE ${conditions.join(" AND ")}
      ORDER BY kc.submitted_at DESC, kc.id DESC
      LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return rows;
}

/**
 * Count KYC applications matching the selected statuses, search and submission-date filters.
 */
async function countKycApplications(statuses, { search, submittedFrom, submittedTo } = {}) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error("At least one KYC status is required");
  }

  const conditions = [`status IN (${statuses.map(() => "?").join(", ")})`];
  const params = [...statuses];

  if (search) {
    conditions.push(`(id = ? OR user_id = ? OR name LIKE ? OR email LIKE ? OR mobile LIKE ?)`);
    const numeric = /^\d+$/.test(search) ? Number(search) : null;
    const like = `%${search}%`;
    params.push(numeric, numeric, like, like, like);
  }

  if (submittedFrom) {
    conditions.push("submitted_at >= ?");
    params.push(submittedFrom);
  }
  if (submittedTo) {
    conditions.push("submitted_at < ?");
    params.push(submittedTo);
  }

  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM kyc_cases
     WHERE ${conditions.join(" AND ")}`,
    params,
  );

  return Number(rows[0].total);
}

function buildRecentKycConditions({
  statuses,
  numericSearch,
  nameSearch,
  submittedFrom,
  submittedTo,
  reviewedFrom,
  reviewedTo,
}) {
  if (!Array.isArray(statuses) || statuses.length === 0) {
    throw new Error("At least one KYC status is required");
  }

  const conditions = [
    `kc.status IN (${statuses.map(() => "?").join(", ")})`,
    "kc.submitted_at IS NOT NULL",
  ];
  const params = [...statuses];

  if (numericSearch !== null && numericSearch !== undefined) {
    conditions.push("(kc.id = ? OR kc.user_id = ?)");
    params.push(numericSearch, numericSearch);
  } else if (nameSearch) {
    conditions.push("u.name LIKE ?");
    params.push(`%${nameSearch}%`);
  }

  if (submittedFrom) {
    conditions.push("kc.submitted_at >= ?");
    params.push(submittedFrom);
  }
  if (submittedTo) {
    conditions.push("kc.submitted_at < ?");
    params.push(submittedTo);
  }
  if (reviewedFrom || reviewedTo) {
    conditions.push("kc.reviewed_at IS NOT NULL");
  }
  if (reviewedFrom) {
    conditions.push("kc.reviewed_at >= ?");
    params.push(reviewedFrom);
  }
  if (reviewedTo) {
    conditions.push("kc.reviewed_at < ?");
    params.push(reviewedTo);
  }

  return { whereClause: conditions.join(" AND "), params };
}

/** Fetches recent, submitted KYC application summaries for the dashboard. */
async function findRecentKycApplications(filters) {
  const { whereClause, params } = buildRecentKycConditions(filters);
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
     WHERE ${whereClause}
     ORDER BY ${filters.reviewedFrom || filters.reviewedTo ? "kc.reviewed_at" : "kc.submitted_at"} DESC, kc.id DESC
     LIMIT ? OFFSET ?`,
    [...params, filters.limit, filters.offset],
  );
  return rows;
}

/** Counts the same filtered, submitted KYC application set as the page query. */
async function countRecentKycApplications(filters) {
  const { whereClause, params } = buildRecentKycConditions(filters);
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total
     FROM kyc_cases kc
     INNER JOIN users u ON u.id = kc.user_id
     WHERE ${whereClause}`,
    params,
  );
  return Number(rows[0]?.total || 0);
}

/**
 * Fetch one KYC application with applicant details.
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

/**
 * Get a dedicated MySQL connection for an admin review transaction.
 */
async function getConnection() {
  return pool.getConnection();
}

/**
 * Lock a KYC case while its review decision is being processed.
 */
async function findKycCaseForUpdate(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT id, status
       FROM kyc_cases
      WHERE id = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId],
  );

  return rows[0] || null;
}

/**
 * Approve a KYC case.
 * The caller must already have locked the case in a transaction.
 */
async function approveKycCase(connection, caseId) {
  const [result] = await connection.execute(
    `UPDATE kyc_cases
        SET status = 'approved',
            reviewed_at = CURRENT_TIMESTAMP,
            rejection_reason = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status IN ('submitted', 'under_review')`,
    [caseId],
  );

  return Number(result.affectedRows || 0) === 1;
}


/**
 * Reject a KYC application.
 *
 * Must be called inside a database transaction
 * after locking the KYC case.
 */
async function rejectKycCase(connection, caseId, rejectionReason) {
  const [result] = await connection.execute(
    `UPDATE kyc_cases
        SET status = 'rejected',
            rejection_reason = ?,
            reviewed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status IN ('submitted', 'under_review')`,
    [rejectionReason, caseId],
  );

  return Number(result.affectedRows || 0) === 1;
}

/**
 * Insert a KYC status-history record.
 * Must use the same connection as the case update.
 */
async function insertStatusHistory(
  connection,
  { caseId, oldStatus, newStatus, actorUserId, reason },
) {
  const [result] = await connection.execute(
    `INSERT INTO kyc_status_history
       (case_id, old_status, new_status, actor_user_id, reason)
     VALUES (?, ?, ?, ?, ?)`,
    [caseId, oldStatus, newStatus, actorUserId, reason ?? null],
  );

  return result.insertId;
}

const adminKycModel = {
  findKycApplications,
  countKycApplications,
  findRecentKycApplications,
  countRecentKycApplications,
  findKycCaseById,
  findKycStepsByCaseId,
  findVerificationsByCaseId,
  findBankDetailsByCaseId,
  findMediaDetailsByCaseId,
  findMediaAssetForAdmin,
  findAgreementsByCaseId,
  getConnection,
  findKycCaseForUpdate,
  approveKycCase,
  rejectKycCase,
  insertStatusHistory,
};

export {
  findKycApplications,
  countKycApplications,
  findRecentKycApplications,
  countRecentKycApplications,
  findKycCaseById,
  findKycStepsByCaseId,
  findVerificationsByCaseId,
  findBankDetailsByCaseId,
  findMediaDetailsByCaseId,
  findMediaAssetForAdmin,
  findAgreementsByCaseId,
  getConnection,
  findKycCaseForUpdate,
  approveKycCase,
  rejectKycCase,
  insertStatusHistory,
};

export default adminKycModel;
