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

export {
  getConnection,
  findCasesByUserIdForUpdate,
  findStepByCaseIdAndNumber,
  insertMediaAsset,
  findMediaByCaseId,
  findMediaByIdAndCaseId,
};
