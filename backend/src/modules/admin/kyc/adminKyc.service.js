
import adminKycModel from "./adminKyc.model.js";
import ApiError from "../../../utils/ApiError.js";
import getCloudinary from "../../../config/cloudinary.js";

const ALLOWED_STATUSES = [
  "submitted",
  "under_review",
  "approved",
  "rejected",
];

const DEFAULT_STATUSES = ["submitted", "under_review"];

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const DOCUMENT_URL_TTL_SECONDS = 5 * 60;

const APPROVABLE_STATUSES = ["submitted", "under_review"];

const MEDIA_FORMATS = {
  "image/jpeg": { resourceType: "image", format: "jpg" },
  "image/png": { resourceType: "image", format: "png" },
  "image/webp": { resourceType: "image", format: "webp" },
  "video/mp4": { resourceType: "video", format: "mp4" },
  "video/quicktime": { resourceType: "video", format: "mov" },
  "video/webm": { resourceType: "video", format: "webm" },
};

function parsePositiveId(value, fieldName) {
  const parsed = Number(value);

  if (
    value === undefined ||
    value === null ||
    String(value).trim() === "" ||
    !Number.isSafeInteger(parsed) ||
    parsed < 1
  ) {
    throw new ApiError(
      400,
      `Invalid ${fieldName}`,
      [],
      "VALIDATION_ERROR",
    );
  }

  return parsed;
}

async function getKycApplications({ status, page, limit } = {}) {
  let statuses = DEFAULT_STATUSES;

  if (status !== undefined && status !== "") {
    if (!ALLOWED_STATUSES.includes(status)) {
      throw new ApiError(
        400,
        "Invalid KYC status filter",
        [],
        "VALIDATION_ERROR",
      );
    }

    statuses = [status];
  }

  const parsedPage = page === undefined ? DEFAULT_PAGE : Number(page);
  const parsedLimit = limit === undefined ? DEFAULT_LIMIT : Number(limit);

  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new ApiError(
      400,
      "Page must be a positive integer",
      [],
      "VALIDATION_ERROR",
    );
  }

  if (
    !Number.isInteger(parsedLimit) ||
    parsedLimit < 1 ||
    parsedLimit > MAX_LIMIT
  ) {
    throw new ApiError(
      400,
      `Limit must be between 1 and ${MAX_LIMIT}`,
      [],
      "VALIDATION_ERROR",
    );
  }

  const offset = (parsedPage - 1) * parsedLimit;

  const [applications, total] = await Promise.all([
    adminKycModel.findKycApplications({
      statuses,
      limit: parsedLimit,
      offset,
    }),
    adminKycModel.countKycApplications(statuses),
  ]);

  const totalPages = Math.ceil(total / parsedLimit);

  return {
    applications,
    pagination: {
      page: parsedPage,
      limit: parsedLimit,
      total,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPreviousPage: parsedPage > 1,
    },
    filters: {
      statuses,
    },
  };
}

/**
 * Fetch complete safe details of one KYC application.
 */
async function getKycApplicationDetails(caseId) {
  const parsedCaseId = parsePositiveId(caseId, "KYC case ID");

  const application = await adminKycModel.findKycCaseById(parsedCaseId);

  if (!application) {
    throw new ApiError(
      404,
      "KYC application not found",
      [],
      "NOT_FOUND",
    );
  }

  const [
    steps,
    verifications,
    bankAccount,
    media,
    agreements,
  ] = await Promise.all([
    adminKycModel.findKycStepsByCaseId(parsedCaseId),
    adminKycModel.findVerificationsByCaseId(parsedCaseId),
    adminKycModel.findBankDetailsByCaseId(parsedCaseId),
    adminKycModel.findMediaDetailsByCaseId(parsedCaseId),
    adminKycModel.findAgreementsByCaseId(parsedCaseId),
  ]);

  return {
    application,
    steps,
    verifications,
    bankAccount,
    media,
    agreements,
  };
}

/**
 * Generate temporary secure access to an admin KYC document.
 */
async function getKycDocumentAccess(caseId, assetId) {
  const parsedCaseId = parsePositiveId(caseId, "KYC case ID");
  const parsedAssetId = parsePositiveId(assetId, "document ID");

  // Verify that the document belongs to this KYC case.
  const asset = await adminKycModel.findMediaAssetForAdmin(
    parsedCaseId,
    parsedAssetId,
  );

  if (!asset) {
    throw new ApiError(
      404,
      "KYC document not found",
      [],
      "NOT_FOUND",
    );
  }

  if (asset.storage_provider !== "cloudinary") {
    throw new ApiError(
      400,
      "Unsupported document storage provider",
      [],
      "UNSUPPORTED_STORAGE_PROVIDER",
    );
  }

  const mediaFormat = MEDIA_FORMATS[asset.mime_type];

  if (!mediaFormat || !asset.storage_key) {
    throw new ApiError(
      400,
      "Unsupported or invalid document format",
      [],
      "INVALID_DOCUMENT_FORMAT",
    );
  }

  const expiresAt =
    Math.floor(Date.now() / 1000) + DOCUMENT_URL_TTL_SECONDS;

  let documentUrl;

  try {
    const cloudinary = getCloudinary();

    documentUrl = cloudinary.utils.private_download_url(
      asset.storage_key,
      mediaFormat.format,
      {
        resource_type: mediaFormat.resourceType,
        type: "authenticated",
        expires_at: expiresAt,
      },
    );
  } catch {
    throw new ApiError(
      503,
      "Document access is temporarily unavailable",
      [],
      "DOCUMENT_ACCESS_UNAVAILABLE",
    );
  }

  return {
    assetId: asset.id,
    caseId: asset.case_id,
    assetType: asset.asset_type,
    mimeType: asset.mime_type,
    documentUrl,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

/**
 * Approve a KYC application transactionally.
 *
 * The case update and status-history insert must either
 * both succeed or both roll back.
 */
async function approveKycApplication(caseId, actorUserId) {
  const parsedCaseId = parsePositiveId(caseId, "KYC case ID");
  const parsedActorUserId = parsePositiveId(
    actorUserId,
    "admin user ID",
  );

  let connection;
  let transactionStarted = false;

  try {
    connection = await adminKycModel.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the case to prevent concurrent review decisions.
    const application = await adminKycModel.findKycCaseForUpdate(
      connection,
      parsedCaseId,
    );

    if (!application) {
      throw new ApiError(
        404,
        "KYC application not found",
        [],
        "NOT_FOUND",
      );
    }

    if (!APPROVABLE_STATUSES.includes(application.status)) {
      throw new ApiError(
        409,
        `KYC application cannot be approved because its current status is '${application.status}'`,
        [],
        "INVALID_KYC_STATE",
      );
    }

    const oldStatus = application.status;

    const updated = await adminKycModel.approveKycCase(
      connection,
      parsedCaseId,
    );

    if (!updated) {
      throw new ApiError(
        409,
        "KYC application status changed. Please refresh and try again.",
        [],
        "INVALID_KYC_STATE",
      );
    }

    await adminKycModel.insertStatusHistory(connection, {
      caseId: parsedCaseId,
      oldStatus,
      newStatus: "approved",
      actorUserId: parsedActorUserId,
      reason: null,
    });

    await connection.commit();
    transactionStarted = false;

    return {
      caseId: parsedCaseId,
      previousStatus: oldStatus,
      status: "approved",
      message: "KYC application approved successfully",
    };
  } catch (error) {
    if (connection && transactionStarted) {
      try {
        await connection.rollback();
      } catch {
        // Preserve the original error if rollback also fails.
      }
    }

    throw error;
  } finally {
    if (connection) {
      connection.release();
    }
  }
}

const adminKycService = {
  getKycApplications,
  getKycApplicationDetails,
  getKycDocumentAccess,
  approveKycApplication,
};

export {
  getKycApplications,
  getKycApplicationDetails,
  getKycDocumentAccess,
  approveKycApplication,
};

export default adminKycService;
