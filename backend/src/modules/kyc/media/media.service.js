import crypto from "node:crypto";
import * as mediaModel from "./media.model.js";
import getCloudinary from "../../../config/cloudinary.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import logger from "../../../utils/logger.js";

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
    mimeTypes: ["video/mp4", "video/quicktime"],
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

  if (typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)) {
    details.code = error.code;
  }

  if (Number.isInteger(error?.http_code)) {
    details.providerStatus = error.http_code;
  }

  if (Object.keys(details).length === 0) {
    details.errorType = error?.name || "UnknownError";
  }

  logger.error("media.operation_failed", { operation, ...details });
}

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

// Check ownership and upload eligibility.
// Called inside a database transaction.

async function findEligibleCase(connection, userId, model = mediaModel) {
  const cases = await model.findCasesByUserIdForUpdate(
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

  // Step 5 requires Step 4 (Bank Details) to be completed.
  const bankDetailsStep = await model.findStepByCaseIdAndNumber(
    connection,
    kycCase.id,
    4,
  );

  if (!bankDetailsStep || bankDetailsStep.status !== "completed") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Complete bank details verification before uploading media.",
      [],
      "KYC_PREREQUISITE_NOT_COMPLETED",
    );
  }

  // Check whether Step 5 is initialized.
  const step = await model.findStepByCaseIdAndNumber(
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

  return kycCase.id;
}


// Verify that the user can upload to an existing KYC case.
async function verifyUploadEligibility(userId, model = mediaModel) {
  const connection = await model.getConnection();
  let rollback = false;

  try {
    await connection.beginTransaction();

    const caseId = await findEligibleCase(connection, userId, model);

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

// Upload file to Cloudinary using a memory buffer.
function uploadToCloudinary(file, rules, caseId) {
  return new Promise((resolve, reject) => {
    try {
      const cloudinary = getCloudinary();

      const uploadStream = cloudinary.uploader.upload_stream(
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

// Remove Cloudinary asset if saving its database record fails.
async function cleanupCloudinaryAsset(publicId, resourceType) {
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

// Main upload operation.
async function uploadMedia(userId, assetType, file, dependencies = {}) {
  const model = dependencies.model || mediaModel;
  const uploadAsset = dependencies.uploadAsset || uploadToCloudinary;
  const cleanupAsset = dependencies.cleanupAsset || cleanupCloudinaryAsset;
  const rules = validateUpload(assetType, file);

  // Initial ownership and eligibility check.
  const caseId = await verifyUploadEligibility(userId, model);

  let cloudinaryResult;

  try {
    cloudinaryResult = await uploadAsset(file, rules, caseId);
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

  let connection;
  try {
    connection = await model.getConnection();
  } catch (error) {
    logMediaFailure("media database connection", error);
    await cleanupAsset(cloudinaryResult.public_id, rules.resourceType);
    throw serviceUnavailable();
  }
  let rollback = false;
  let databaseSaved = false;

  try {
    await connection.beginTransaction();

    // Recheck eligibility to avoid saving against a changed case.
    const currentCaseId = await findEligibleCase(connection, userId, model);

    if (currentCaseId !== caseId) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "KYC application changed during upload.",
        [],
        "KYC_CASE_CHANGED",
      );
    }

    // Preserve previous evidence while making the new upload the current asset.
    // Both this update and the insert roll back together if persistence fails.
    await model.supersedeCurrentAssets(connection, caseId, assetType);

    const mediaId = await model.insertMediaAsset(connection, {
      caseId,
      assetType,
      storageProvider: "cloudinary",
      storageKey: cloudinaryResult.public_id,
      mimeType: file.detectedMimeType,
      fileSizeBytes: file.size,
    });

    // Step 5 is complete only when all three required media types exist.
    const allRequiredMediaUploaded = await model.hasAllRequiredMedia(
      connection,
      caseId,
    );

    const step5 = await model.findStepByCaseIdAndNumber(
      connection,
      caseId,
      MEDIA_STEP,
    );
    if (allRequiredMediaUploaded && step5?.status !== "completed") {
      const step5Completed = await model.completeStep5(connection, caseId);
      if (!step5Completed) {
        throw new ApiError(
          httpStatus.CONFLICT,
          "Unable to complete media upload step.",
          [],
          "KYC_STEP_COMPLETION_FAILED",
        );
      }
    }

    const stepsCompleted = await model.updateCompletedStepsCount(
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
      ...(stepsCompleted !== null ? { steps_completed: stepsCompleted } : {}),
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
      await cleanupAsset(
        cloudinaryResult.public_id,
        rules.resourceType,
      );
    }
  }
}

export { uploadMedia };
