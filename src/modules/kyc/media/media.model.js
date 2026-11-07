import pool from "../../../config/db.js";

// Get a database connection for transaction-based operations.
async function getConnection() {
  return pool.getConnection();
}

// Find the user's KYC case.
// LIMIT 2 allows the service to detect unexpected duplicate cases.
async function findCasesByUserIdForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, user_id, status, steps_completed
       FROM kyc_cases
      WHERE user_id = ?
      ORDER BY id ASC
      LIMIT 2
      FOR UPDATE`,
    [userId],
  );

  return rows;
}

// Find a particular KYC step.
async function findStepByCaseIdAndNumber(connection, caseId, stepNumber) {
  const [rows] = await connection.execute(
    `SELECT id, case_id, step_number, status, completed_at, failure_code
       FROM kyc_steps
      WHERE case_id = ? AND step_number = ?
      LIMIT 1
      FOR UPDATE`,
    [caseId, stepNumber],
  );

  return rows[0] || null;
}

// Insert uploaded media metadata.
async function insertMediaAsset(connection, mediaData) {
  const {
    caseId,
    assetType,
    storageProvider,
    storageKey,
    mimeType,
    fileSizeBytes,
  } = mediaData;

  const [result] = await connection.execute(
    `INSERT INTO media_assets (
       case_id,
       asset_type,
       storage_provider,
       storage_key,
       mime_type,
       file_size_bytes
     )
     VALUES (?, ?, ?, ?, ?, ?)`,
    [caseId, assetType, storageProvider, storageKey, mimeType, fileSizeBytes],
  );

  return result.insertId;
}

// Get all media records belonging to a KYC case.
async function findMediaByCaseId(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       case_id,
       asset_type,
       storage_provider,
       storage_key,
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

// Find one media record scoped to its KYC case.
async function findMediaByIdAndCaseId(connection, assetId, caseId) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       case_id,
       asset_type,
       storage_provider,
       storage_key,
       mime_type,
       file_size_bytes,
       status,
       created_at
     FROM media_assets
     WHERE id = ? AND case_id = ?
     LIMIT 1`,
    [assetId, caseId],
  );

  return rows[0] || null;
}
async function hasAllRequiredMedia(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(DISTINCT asset_type) AS uploaded_count
       FROM media_assets
      WHERE case_id = ?
        AND asset_type IN ('shop_image', 'selfie', 'consent_video')
        AND status IN ('uploaded', 'verified')`,
    [caseId],
  );

  return Number(rows[0]?.uploaded_count || 0) === 3;
}

async function completeStep5(connection, caseId) {
  const [result] = await connection.execute(
    `UPDATE kyc_steps
        SET status = 'completed',
            completed_at = CURRENT_TIMESTAMP,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number = 5
        AND status <> 'completed'`,
    [caseId],
  );
  return Number(result.affectedRows || 0) === 1;
}

async function updateCompletedStepsCount(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS steps_completed
       FROM kyc_steps
      WHERE case_id = ?
        AND status = 'completed'`,
    [caseId],
  );
  const stepsCompleted = Number(rows[0]?.steps_completed || 0);
  await connection.execute(
    `UPDATE kyc_cases
        SET steps_completed = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [stepsCompleted, caseId],
  );
  return stepsCompleted;
}

export {
  getConnection,
  findCasesByUserIdForUpdate,
  findStepByCaseIdAndNumber,
  insertMediaAsset,
  findMediaByCaseId,
  findMediaByIdAndCaseId,
  hasAllRequiredMedia,
  completeStep5,
  updateCompletedStepsCount,
};
