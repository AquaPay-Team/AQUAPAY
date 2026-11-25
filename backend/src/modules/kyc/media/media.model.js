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

// Find and lock existing media records before deletion.
async function findMediaByCaseIdForUpdate(connection, caseId) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       case_id,
       asset_type,
       storage_provider,
       storage_key,
       status
     FROM media_assets
     WHERE case_id = ?
     ORDER BY id ASC
     FOR UPDATE`,
    [caseId],
  );

  return rows;
}

// Permanently delete old media records from database.
async function deleteMediaByCaseId(connection, caseId) {
  const [result] = await connection.execute(
    `DELETE FROM media_assets
     WHERE case_id = ?`,
    [caseId],
  );

  return Number(result.affectedRows || 0);
}

// Save Cloudinary cleanup jobs inside the current transaction.
async function insertMediaCleanupJobs(connection, caseId, mediaAssets) {
  if (!Array.isArray(mediaAssets) || mediaAssets.length === 0) {
    return 0;
  }

  let insertedCount = 0;

  for (const asset of mediaAssets) {
    if (
  asset.storage_provider !== "cloudinary" ||
  !asset.storage_key
   ) {
  throw new Error(
    `Invalid media cleanup asset: ${asset.id}`,
   );
  }

    const resourceType =
      asset.asset_type === "consent_video" ? "video" : "image";

    const [result] = await connection.execute(
      `INSERT INTO kyc_media_cleanup_outbox (
         case_id,
         media_asset_id,
         storage_provider,
         storage_key,
         resource_type
       )
        VALUES (?, ?, ?, ?, ?)`,
      [
        caseId,
        asset.id,
        asset.storage_provider,
        asset.storage_key,
        resourceType,
      ],
    );

    if (result.affectedRows > 0) {
      insertedCount += 1;
    }
  }

  return insertedCount;
}


/**
 * Claim one eligible Cloudinary cleanup job.
 *
 * Must run inside a transaction.
 * SKIP LOCKED prevents concurrent workers from
 * claiming the same job.
 */
async function claimNextMediaCleanupJob(connection) {
  const [rows] = await connection.execute(
    `SELECT
       id,
       case_id,
       media_asset_id,
       storage_provider,
       storage_key,
       resource_type,
       status,
       attempts
     FROM kyc_media_cleanup_outbox
     WHERE
       (
         status = 'pending'
         AND (
           next_attempt_at IS NULL
           OR next_attempt_at <= CURRENT_TIMESTAMP
         )
       )
       OR
       (
         status = 'processing'
         AND locked_at <= DATE_SUB(
           CURRENT_TIMESTAMP,
           INTERVAL 10 MINUTE
         )
       )
     ORDER BY created_at ASC, id ASC
     LIMIT 1
     FOR UPDATE SKIP LOCKED`,
    [],
  );

  const job = rows[0];

  if (!job) {
    return null;
  }

  await connection.execute(
    `UPDATE kyc_media_cleanup_outbox
        SET status = 'processing',
            locked_at = CURRENT_TIMESTAMP,
            attempts = attempts + 1,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [job.id],
  );

  return {
    ...job,
    attempts: Number(job.attempts || 0) + 1,
  };
}


/**
 * Mark a cleanup job as completed after
 * Cloudinary confirms successful deletion.
 */
async function markMediaCleanupCompleted(connection, jobId) {
  const [result] = await connection.execute(
    `UPDATE kyc_media_cleanup_outbox
        SET status = 'completed',
            locked_at = NULL,
            next_attempt_at = NULL,
            last_error = NULL,
            completed_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
        AND status = 'processing'`,
    [jobId],
  );

  return Number(result.affectedRows || 0) === 1;
}


/**
 * Schedule another cleanup attempt after failure.
 * Uses exponential backoff, capped at 24 hours.
 */
async function scheduleMediaCleanupRetry(
  connection,
  jobId,
  errorMessage,
  maxAttempts = 8,
) {
  const [rows] = await connection.execute(
    `SELECT attempts
       FROM kyc_media_cleanup_outbox
      WHERE id = ?
        AND status = 'processing'
      LIMIT 1
      FOR UPDATE`,
    [jobId],
  );

  const job = rows[0];

  if (!job) {
    return false;
  }

  const attempts = Number(job.attempts || 0);

  const permanentlyFailed = attempts >= maxAttempts;

  const delayMinutes = Math.min(
    5 * (2 ** Math.max(attempts - 1, 0)),
    1440,
  );

  await connection.execute(
    `UPDATE kyc_media_cleanup_outbox
        SET status = ?,
            locked_at = NULL,
            next_attempt_at = CASE
              WHEN ? = 'pending'
              THEN DATE_ADD(
                CURRENT_TIMESTAMP,
                INTERVAL ? MINUTE
              )
              ELSE NULL
            END,
            last_error = ?,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [
      permanentlyFailed ? 'failed' : 'pending',
      permanentlyFailed ? 'failed' : 'pending',
      delayMinutes,
      String(errorMessage || 'Unknown cleanup error').slice(0, 2000),
      jobId,
    ],
  );

  return true;
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

  // Reset media upload, agreement acceptance,
// and final submission steps.

const [stepResult] = await connection.execute(
  `UPDATE kyc_steps
      SET status = 'pending',
          completed_at = NULL,
          failure_code = NULL,
          updated_at = CURRENT_TIMESTAMP
    WHERE case_id = ?
      AND step_number IN (5, 6, 7)`,
  [caseId],
);

// Steps 1-4 remain unchanged.
// Calculate completed steps count from DB.
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
            submitted_at = NULL,
            reviewed_at = NULL,
            rejection_reason = NULL,
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
  findMediaByCaseIdForUpdate,
  deleteMediaByCaseId,
  insertMediaCleanupJobs,
  claimNextMediaCleanupJob,
  markMediaCleanupCompleted,
  scheduleMediaCleanupRetry,
};
