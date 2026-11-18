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

async function invalidatePreviousMedia(connection, caseId) {
  const [result] = await connection.execute(
    `UPDATE media_assets
        SET status = 'rejected'
      WHERE case_id = ?
        AND status IN ('uploaded', 'verified')`,
    [caseId],
  );

  return Number(result.affectedRows || 0);
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

// Count how many distinct asset types have been successfully uploaded for this case.
// Used to decide whether to mark Step 5 as complete (all 3 types required).
async function countUploadedAssetTypes(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT COUNT(DISTINCT asset_type) AS type_count
       FROM media_assets
      WHERE case_id = ?
        AND status IN ('uploaded', 'verified')`,
    [caseId],
  );
  return Number(rows[0]?.type_count || 0);
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

/**
 * Reset KYC progress for a rejected application's
 * media re-upload attempt.
 *
 * Must run inside a transaction after locking the case.
 * Steps 1–4 remain unchanged.
 */
async function resetKycProgressFromStep5(connection, caseId) {
  // Reset media-upload and final-submission steps.
  const [stepResult] = await connection.execute(
    `UPDATE kyc_steps
        SET status = 'pending',
            completed_at = NULL,
            failure_code = NULL,
            updated_at = CURRENT_TIMESTAMP
      WHERE case_id = ?
        AND step_number IN (5, 7)`,
    [caseId],
  );

  // Keep Step 6 unchanged until its repeat requirement
  // is confirmed. Calculate the completed count from DB.
  const [rows] = await connection.execute(
    `SELECT COUNT(*) AS completed_count
       FROM kyc_steps
      WHERE case_id = ?
        AND status = 'completed'`,
    [caseId],
  );

  const completedCount = Number(rows[0]?.completed_count || 0);

  const [caseResult] = await connection.execute(
    `UPDATE kyc_cases
        SET current_step = 5,
            steps_completed = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'rejected'`,
    [completedCount, caseId],
  );

  if (Number(caseResult.affectedRows || 0) !== 1) {
    throw new Error("Unable to reset rejected KYC progress");
  }

  return {
    currentStep: 5,
    stepsCompleted: completedCount,
    stepRowsAffected: Number(stepResult.affectedRows || 0),
  };
}

async function reopenRejectedKycCase(connection, caseId) {
  const [result] = await connection.execute(
    `UPDATE kyc_cases
        SET status = 'pending',
            current_step = 5,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'rejected'`,
    [caseId],
  );

  return Number(result.affectedRows || 0) === 1;
}


async function insertRestartStatusHistory(connection, caseId, actorUserId) {
  const [result] = await connection.execute(
    `INSERT INTO kyc_status_history
       (case_id, old_status, new_status, actor_user_id, reason)
     VALUES (?, 'rejected', 'pending', ?, ?)`,
    [
      caseId,
      actorUserId,
      "Merchant restarted KYC from Step 5 after rejection",
    ],
  );

  return result.insertId;
}


export {
  getConnection,
  insertMediaAsset,
  findMediaByCaseId,
  findMediaByIdAndCaseId,
  countUploadedAssetTypes,
  invalidatePreviousMedia,
  hasAllRequiredMedia,
  completeStep5,
  updateCompletedStepsCount,
  resetKycProgressFromStep5,
  reopenRejectedKycCase,
  insertRestartStatusHistory,
  findCasesByUserIdForUpdate,
  findStepByCaseIdAndNumber,
};
