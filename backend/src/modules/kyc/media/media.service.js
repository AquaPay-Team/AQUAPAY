import crypto from "node:crypto";
import * as mediaModel from "./media.model.js";
import getCloudinary from "../../../config/cloudinary.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const MEDIA_STEP = 5;
const IMAGE_MAX_SIZE = 5 * 1024 * 1024;
const VIDEO_MAX_SIZE = 20 * 1024 * 1024;

const MEDIA_RULES = {
  shop_image: {
    resourceType: "image",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: IMAGE_MAX_SIZE,
  },
  selfie: {
    resourceType: "image",
    mimeTypes: ["image/jpeg", "image/png", "image/webp"],
    maxSize: IMAGE_MAX_SIZE,
  },
  consent_video: {
    resourceType: "video",
    mimeTypes: ["video/mp4", "video/quicktime", "video/webm"],
    maxSize: VIDEO_MAX_SIZE,
  },
};

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

function logMediaFailure(operation, error) {
  const details = {};

  if (
    typeof error?.code === "string" &&
    /^[A-Z0-9_]+$/.test(error.code)
  ) {
    details.code = error.code;
  }

  if (Number.isInteger(error?.http_code)) {
    details.providerStatus = error.http_code;
  }

  if (Object.keys(details).length === 0) {
    details.errorType = error?.name || "UnknownError";
  }

  console.error(
    `[AquaPay Media] ${operation} failed`,
    details,
  );
}

/**
 * Safely release a database connection.
 *
 * If rollback or release fails, destroy the connection
 * instead of returning an unsafe connection to the pool.
 */
async function releaseConnection(connection, rollback = false) {
  if (!connection) return;

  try {
    if (rollback) {
      await connection.rollback();
    }

    connection.release();
  } catch (error) {
    logMediaFailure("connection cleanup", error);

    try {
      connection.destroy();
    } catch {
      // Connection could not be reused.
    }
  }
}

/**
 * Validate media type, file presence, MIME type
 * and maximum allowed file size.
 */
function validateUpload(assetType, file) {
  const rules = MEDIA_RULES[assetType];

  if (!rules) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid media type.",
      [],
      "INVALID_MEDIA_TYPE",
    );
  }

  if (!file?.buffer) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "A media file is required.",
      [],
      "FILE_REQUIRED",
    );
  }

  const mimeType = file.detectedMimeType;

  if (!rules.mimeTypes.includes(mimeType)) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Unsupported media format for this upload.",
      [],
      "INVALID_FILE_TYPE",
    );
  }

  if (file.size > rules.maxSize) {
    throw new ApiError(
      413,
      `File exceeds the allowed size for ${assetType}.`,
      [],
      "FILE_TOO_LARGE",
    );
  }

  return rules;
}

/**
 * Check ownership and upload eligibility.
 *
 * Must be called inside a database transaction.
 */
async function findEligibleCase(connection, userId) {
  const cases =
    await mediaModel.findCasesByUserIdForUpdate(
      connection,
      userId,
    );

  if (cases.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "KYC application not found.",
      [],
      "KYC_CASE_NOT_FOUND",
    );
  }

  if (cases.length > 1) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Multiple KYC applications found. Contact support.",
      [],
      "KYC_CASE_AMBIGUOUS",
    );
  }

  const kycCase = cases[0];

  if (kycCase.status !== "pending") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "This KYC application cannot be modified.",
      [],
      "KYC_CASE_NOT_EDITABLE",
    );
  }

  // Step 5 requires Step 4 to be completed.
  const bankDetailsStep =
    await mediaModel.findStepByCaseIdAndNumber(
      connection,
      kycCase.id,
      4,
    );

  if (
    !bankDetailsStep ||
    bankDetailsStep.status !== "completed"
  ) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Complete bank details verification before uploading media.",
      [],
      "KYC_PREREQUISITE_NOT_COMPLETED",
    );
  }

  // Verify Step 5 exists.
  const step =
    await mediaModel.findStepByCaseIdAndNumber(
      connection,
      kycCase.id,
      MEDIA_STEP,
    );

  if (!step) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Media upload step is not initialized.",
      [],
      "KYC_STEP_NOT_INITIALIZED",
    );
  }

  if (step.status === "completed") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Media upload step is already completed.",
      [],
      "KYC_STEP_ALREADY_COMPLETED",
    );
  }

  return kycCase.id;
}

/**
 * Verify that the authenticated merchant can upload
 * media to their existing KYC application.
 */
async function verifyUploadEligibility(userId) {
  const connection = await mediaModel.getConnection();
  let rollback = false;

  try {
    await connection.beginTransaction();

    const caseId = await findEligibleCase(
      connection,
      userId,
    );

    await connection.commit();

    return caseId;
  } catch (error) {
    rollback = true;

    if (error instanceof ApiError) {
      throw error;
    }

    logMediaFailure("eligibility check", error);
    throw serviceUnavailable();
  } finally {
    await releaseConnection(connection, rollback);
  }
}

/**
 * Upload media to Cloudinary.
 */
function uploadToCloudinary(file, rules, caseId) {
  return new Promise((resolve, reject) => {
    try {
      const cloudinary = getCloudinary();

      const uploadStream =
        cloudinary.uploader.upload_stream(
          {
            resource_type: rules.resourceType,
            type: "authenticated",
            folder: `aquapay/kyc/${caseId}`,
            public_id: crypto.randomUUID(),
            overwrite: false,
            use_filename: false,
            unique_filename: false,
          },
          (error, result) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(result);
          },
        );

      uploadStream.end(file.buffer);
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Delete a Cloudinary asset if database persistence
 * fails after a successful upload.
 */
async function cleanupCloudinaryAsset(
  publicId,
  resourceType,
) {
  if (!publicId) return;

  try {
    const cloudinary = getCloudinary();

    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
      type: "authenticated",
      invalidate: true,
    });
  } catch (error) {
    logMediaFailure("Cloudinary cleanup", error);
  }
}

/**
 * Upload a KYC media asset.
 *
 * Supported assets:
 * - shop_image
 * - selfie
 * - consent_video
 *
 * Step 5 is completed only after all three required
 * asset types have been uploaded.
 */
async function uploadMedia(userId, assetType, file) {
  const rules = validateUpload(assetType, file);

  // Initial ownership and eligibility check.
  const caseId = await verifyUploadEligibility(userId);

  let cloudinaryResult;

  try {
    cloudinaryResult = await uploadToCloudinary(
      file,
      rules,
      caseId,
    );
  } catch (error) {
    logMediaFailure("Cloudinary upload", error);

    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Media storage is temporarily unavailable.",
      [],
      "MEDIA_STORAGE_UNAVAILABLE",
    );
  }

  if (!cloudinaryResult?.public_id) {
    throw new ApiError(
      httpStatus.SERVICE_UNAVAILABLE,
      "Media storage did not return a valid upload reference.",
      [],
      "MEDIA_STORAGE_UNAVAILABLE",
    );
  }

  const connection = await mediaModel.getConnection();

  let rollback = false;
  let databaseSaved = false;

  try {
    await connection.beginTransaction();

    // Recheck eligibility before database insertion.
    const currentCaseId = await findEligibleCase(
      connection,
      userId,
    );

    if (currentCaseId !== caseId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "KYC application changed during upload.",
        [],
        "KYC_CASE_CHANGED",
      );
    }

    // Save new media metadata.
    const mediaId = await mediaModel.insertMediaAsset(
      connection,
      {
        caseId,
        assetType,
        storageProvider: "cloudinary",
        storageKey: cloudinaryResult.public_id,
        mimeType: file.detectedMimeType,
        fileSizeBytes: file.size,
      },
    );

    // Step 5 is complete only when all required media
    // asset types exist with active upload statuses.
    const allRequiredMediaUploaded =
      await mediaModel.hasAllRequiredMedia(
        connection,
        caseId,
      );

    if (allRequiredMediaUploaded) {
      const step5Completed =
        await mediaModel.completeStep5(
          connection,
          caseId,
        );

      if (!step5Completed) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Unable to complete media upload step.",
          [],
          "KYC_STEP_COMPLETION_FAILED",
        );
      }
    }

    // Recalculate progress from completed step records.
    const stepsCompleted =
      await mediaModel.updateCompletedStepsCount(
        connection,
        caseId,
      );

    await connection.commit();
    databaseSaved = true;

    return {
      id: mediaId,
      assetType,
      storageProvider: "cloudinary",
      mimeType: file.detectedMimeType,
      fileSizeBytes: file.size,
      status: "uploaded",
      allUploadsComplete: allRequiredMediaUploaded,
      ...(stepsCompleted !== null
        ? { steps_completed: stepsCompleted }
        : {}),
    };
  } catch (error) {
    rollback = true;

    if (error instanceof ApiError) {
      throw error;
    }

    logMediaFailure("media database save", error);
    throw serviceUnavailable();
  } finally {
    await releaseConnection(connection, rollback);

    if (!databaseSaved) {
      await cleanupCloudinaryAsset(
        cloudinaryResult.public_id,
        rules.resourceType,
      );
    }
  }
}

/**
 * Restart a rejected KYC application from Step 5.
 *
 * Business rules:
 *
 * 1. Only the authenticated KYC owner may restart.
 * 2. Case must currently be rejected.
 * 3. Steps 1-4 must remain completed.
 * 4. Old media is invalidated for the new attempt.
 * 5. Steps 5 and 7 are reset to pending.
 * 6. Step 6 remains unchanged for now.
 * 7. Case is reopened as pending at Step 5.
 * 8. A status-history entry is recorded.
 *
 * Every database change occurs inside one transaction.
 */
async function restartRejectedKyc(userId) {
  if (
    !Number.isSafeInteger(Number(userId)) ||
    Number(userId) < 1
  ) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await mediaModel.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Find and lock the authenticated merchant's case.
    const cases =
      await mediaModel.findCasesByUserIdForUpdate(
        connection,
        Number(userId),
      );

    if (cases.length === 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "KYC application not found.",
        [],
        "KYC_CASE_NOT_FOUND",
      );
    }

    if (cases.length > 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Multiple KYC applications found.",
        [],
        "KYC_CASE_AMBIGUOUS",
      );
    }

    const kycCase = cases[0];

    // Only rejected applications can restart.
    if (kycCase.status !== "rejected") {
      throw new ApiError(
        httpStatus.CONFLICT,
        `KYC cannot be restarted from status '${kycCase.status}'.`,
        [],
        "INVALID_KYC_STATE",
      );
    }

    const caseId = kycCase.id;

    // Preserve Steps 1-4.
    // Verify that each prerequisite was completed.
    for (const stepNumber of [1, 2, 3, 4]) {
      const step =
        await mediaModel.findStepByCaseIdAndNumber(
          connection,
          caseId,
          stepNumber,
        );

      if (!step || step.status !== "completed") {
        throw new ApiError(
          httpStatus.CONFLICT,
          `KYC Step ${stepNumber} must be completed before restart.`,
          [],
          "KYC_PREREQUISITE_NOT_COMPLETED",
        );
      }
    }

    // Ensure Step 5 and Step 7 records exist.
    for (const stepNumber of [5, 7]) {
      const step =
        await mediaModel.findStepByCaseIdAndNumber(
          connection,
          caseId,
          stepNumber,
        );

      if (!step) {
        throw new ApiError(
          httpStatus.CONFLICT,
          `KYC Step ${stepNumber} is not initialized.`,
          [],
          "KYC_STEP_NOT_INITIALIZED",
        );
      }
    }

    // Invalidate media from earlier submissions.
    // Records and Cloudinary assets are preserved.
    const invalidatedMediaCount =
      await mediaModel.invalidatePreviousMedia(
        connection,
        caseId,
      );

    // Reset progress starting from Step 5.
    const progress =
      await mediaModel.resetKycProgressFromStep5(
        connection,
        caseId,
      );

    // Reopen the case so new media can be uploaded.
    const reopened =
      await mediaModel.reopenRejectedKycCase(
        connection,
        caseId,
      );

    if (!reopened) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Unable to reopen rejected KYC application.",
        [],
        "KYC_RESTART_FAILED",
      );
    }

    // Record the rejected -> pending transition.
    await mediaModel.insertRestartStatusHistory(
      connection,
      caseId,
      Number(userId),
    );

    // Commit only after every operation succeeds.
    await connection.commit();
    transactionStarted = false;

    return {
      caseId,
      previousStatus: "rejected",
      status: "pending",
      currentStep: progress.currentStep,
      stepsCompleted: progress.stepsCompleted,
      invalidatedMediaCount,
      requiredMedia: [
        "shop_image",
        "selfie",
        "consent_video",
      ],
      message: "KYC restarted from Step 5 successfully",
    };
  } catch (error) {
    // Rollback is handled during connection cleanup.
    // If rollback fails, the helper destroys the connection.
    if (error instanceof ApiError) {
      throw error;
    }

    logMediaFailure("KYC restart", error);
    throw serviceUnavailable();
  } finally {
    await releaseConnection(
      connection,
      transactionStarted,
    );
  }
}

export {
  uploadMedia,
  restartRejectedKyc,
};
