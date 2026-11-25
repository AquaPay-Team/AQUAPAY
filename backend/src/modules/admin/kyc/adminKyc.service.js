
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

const DEFAULT_LIMIT = 25;
const RECENT_DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

const DOCUMENT_URL_TTL_SECONDS = 5 * 60;

const APPROVABLE_STATUSES = ["submitted", "under_review"];

const REJECTABLE_STATUSES = ["submitted", "under_review"];
const MAX_REJECTION_REASON_LENGTH = 500;

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

function validationError(message) {
  return new ApiError(400, message, [], "VALIDATION_ERROR");
}

function readSingleQueryValue(value, fieldName) {
  if (Array.isArray(value)) {
    throw validationError(`${fieldName} must be provided once`);
  }
  return value;
}

function parsePositiveQueryInteger(value, fieldName, { defaultValue, max } = {}) {
  const raw = readSingleQueryValue(value, fieldName);
  if (raw === undefined || raw === "") return defaultValue;

  const parsed = typeof raw === "number" ? raw : /^\d+$/.test(String(raw)) ? Number(raw) : NaN;
  if (
    !Number.isSafeInteger(parsed) ||
    parsed < 1 ||
    (max !== undefined && parsed > max)
  ) {
    throw validationError(
      max === undefined
        ? `${fieldName} must be a positive integer`
        : `${fieldName} must be a positive integer no greater than ${max}`,
    );
  }

  return parsed;
}

function parseOptionalIsoInstant(value, fieldName) {
  const raw = readSingleQueryValue(value, fieldName);
  if (raw === undefined || raw === "") return null;
  if (typeof raw !== "string") {
    throw validationError(`${fieldName} must be an ISO-8601 instant`);
  }

  const match = raw.match(ISO_INSTANT);
  if (!match) throw validationError(`${fieldName} must be an ISO-8601 instant`);

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (
    calendarDate.getUTCFullYear() !== year ||
    calendarDate.getUTCMonth() !== month - 1 ||
    calendarDate.getUTCDate() !== day
  ) {
    throw validationError(`${fieldName} must be an ISO-8601 instant`);
  }

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw validationError(`${fieldName} must be an ISO-8601 instant`);
  }
  return parsed;
}

function parseRecentSearch(value) {
  const raw = readSingleQueryValue(value, "search");
  if (raw === undefined || raw === "") {
    return { numericSearch: null, nameSearch: null };
  }
  if (typeof raw !== "string") throw validationError("search must be a string");

  const search = raw.trim();
  if (!search) return { numericSearch: null, nameSearch: null };
  if (search.length > 100) throw validationError("search must not exceed 100 characters");

  if (/^\d+$/.test(search)) {
    const numericSearch = Number(search);
    if (!Number.isSafeInteger(numericSearch) || numericSearch < 1) {
      throw validationError("search ID must be a positive integer");
    }
    return { numericSearch, nameSearch: null };
  }

  return { numericSearch: null, nameSearch: search };
}

function readCursor(cursor) {
  const raw = readSingleQueryValue(cursor, "cursor");
  if (raw === undefined || raw === "") return null;
  if (typeof raw !== "string") throw validationError("cursor must be a string");
  if (raw.length > 512) throw validationError("cursor is invalid");
  try {
    adminKycModel.decodeCursor(raw);
  } catch {
    throw validationError("Invalid cursor");
  }
  return raw;
}

function buildCursorPagination(applications, limit, hasMore, sortColumn) {
  const last = applications[applications.length - 1];
  // Previous navigation is stateless on the client: it reuses the nextCursor
  // returned with the preceding page. A server-generated prevCursor would
  // require an extra reverse-order query and is intentionally omitted.
  return {
    limit,
    hasMore,
    nextCursor: last ? adminKycModel.encodeCursor(last[sortColumn], last.case_id) : null,
  };
}

async function getKycApplications({ status, limit, cursor, search, submittedFrom, submittedTo } = {}) {
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

  const parsedLimit = parsePositiveQueryInteger(limit, "limit", {
    defaultValue: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });
  const parsedCursor = readCursor(cursor);

  if (search && typeof search !== "string") {
    throw new ApiError(400, "search must be a string", [], "VALIDATION_ERROR");
  }
  if (search && search.length > 100) {
    throw new ApiError(400, "search must not exceed 100 characters", [], "VALIDATION_ERROR");
  }

  const rows = await adminKycModel.findKycApplicationsCursor({
    statuses,
    limit: parsedLimit,
    cursor: parsedCursor,
    search,
    submittedFrom,
    submittedTo,
  });

  const hasMore = rows.length > parsedLimit;
  const applications = rows.slice(0, parsedLimit);

  return {
    applications,
    pagination: buildCursorPagination(applications, parsedLimit, hasMore, "submitted_at"),
    filters: {
      statuses,
    },
  };
}

async function getRecentKycApplications(query = {}) {
  const status = readSingleQueryValue(query.status, "status");
  let statuses = ALLOWED_STATUSES;
  if (status !== undefined && status !== "") {
    if (typeof status !== "string" || !ALLOWED_STATUSES.includes(status)) {
      throw validationError("Invalid KYC status filter");
    }
    statuses = [status];
  }
  const limit = parsePositiveQueryInteger(query.limit, "limit", {
    defaultValue: RECENT_DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });
  const parsedCursor = readCursor(query.cursor);
  const { numericSearch, nameSearch } = parseRecentSearch(query.search);
  const submittedFrom = parseOptionalIsoInstant(
    query.submittedFrom,
    "submittedFrom",
  );
  const submittedTo = parseOptionalIsoInstant(query.submittedTo, "submittedTo");
  const reviewedFrom = parseOptionalIsoInstant(query.reviewedFrom, "reviewedFrom");
  const reviewedTo = parseOptionalIsoInstant(query.reviewedTo, "reviewedTo");

  if (submittedFrom && submittedTo && submittedFrom >= submittedTo) {
    throw validationError("submittedFrom must be before submittedTo");
  }
  if (reviewedFrom && reviewedTo && reviewedFrom >= reviewedTo) {
    throw validationError("reviewedFrom must be before reviewedTo");
  }
  if ((reviewedFrom || reviewedTo) && (statuses.length !== 1 || statuses[0] !== "approved")) {
    throw validationError("reviewedFrom and reviewedTo require status=approved");
  }

  const filters = {
    statuses,
    numericSearch,
    nameSearch,
    submittedFrom,
    submittedTo,
    reviewedFrom,
    reviewedTo,
    cursor: parsedCursor,
    limit,
  };
  const rows = await adminKycModel.findRecentKycApplicationsCursor(filters);

  const hasMore = rows.length > limit;
  const applications = rows.slice(0, limit);
  const sortColumn = reviewedFrom || reviewedTo ? "reviewed_at" : "submitted_at";

  return {
    applications,
    pagination: buildCursorPagination(applications, limit, hasMore, sortColumn),
    filters: {
      statuses,
      ...(submittedFrom ? { submittedFrom: submittedFrom.toISOString() } : {}),
      ...(submittedTo ? { submittedTo: submittedTo.toISOString() } : {}),
      ...(reviewedFrom ? { reviewedFrom: reviewedFrom.toISOString() } : {}),
      ...(reviewedTo ? { reviewedTo: reviewedTo.toISOString() } : {}),
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
 * Fetch complete safe details of one KYC application by User ID.
 */
async function getKycApplicationDetailsByUserId(userId) {
  const parsedUserId = parsePositiveId(userId, "User ID");

  const application = await adminKycModel.findKycCaseByUserId(parsedUserId);

  if (!application) {
    throw new ApiError(
      404,
      "No KYC application found for this user",
      [],
      "NOT_FOUND",
    );
  }

  const caseId = application.case_id;

  const [
    steps,
    verifications,
    bankAccount,
    media,
    agreements,
  ] = await Promise.all([
    adminKycModel.findKycStepsByCaseId(caseId),
    adminKycModel.findVerificationsByCaseId(caseId),
    adminKycModel.findBankDetailsByCaseId(caseId),
    adminKycModel.findMediaDetailsByCaseId(caseId),
    adminKycModel.findAgreementsByCaseId(caseId),
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


/**
 * Reject a KYC application transactionally.
 *
 * The rejection and status-history record must either
 * both succeed or both roll back.
 */
async function rejectKycApplication(caseId, actorUserId, rejectionReason) {
  const parsedCaseId = parsePositiveId(caseId, "KYC case ID");
  const parsedActorUserId = parsePositiveId(
    actorUserId,
    "admin user ID",
  );

  // Validate the rejection reason before opening a DB transaction.
  if (typeof rejectionReason !== "string") {
    throw new ApiError(
      400,
      "Rejection reason is required",
      [],
      "VALIDATION_ERROR",
    );
  }

  const normalizedReason = rejectionReason.trim();

  if (!normalizedReason) {
    throw new ApiError(
      400,
      "Rejection reason cannot be empty",
      [],
      "VALIDATION_ERROR",
    );
  }

  if (normalizedReason.length > MAX_REJECTION_REASON_LENGTH) {
    throw new ApiError(
      400,
      `Rejection reason must not exceed ${MAX_REJECTION_REASON_LENGTH} characters`,
      [],
      "VALIDATION_ERROR",
    );
  }

  let connection;
  let transactionStarted = false;

  try {
    connection = await adminKycModel.getConnection();

    await connection.beginTransaction();
    transactionStarted = true;

    // Lock the KYC case to prevent concurrent admin decisions.
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

    if (!REJECTABLE_STATUSES.includes(application.status)) {
      throw new ApiError(
        409,
        `KYC application cannot be rejected because its current status is '${application.status}'`,
        [],
        "INVALID_KYC_STATE",
      );
    }

    const oldStatus = application.status;

    const updated = await adminKycModel.rejectKycCase(
      connection,
      parsedCaseId,
      normalizedReason,
    );

    if (!updated) {
      throw new ApiError(
        409,
        "KYC application status changed. Please refresh and try again.",
        [],
        "INVALID_KYC_STATE",
      );
    }

    // Record the rejection in the audit trail.
    await adminKycModel.insertStatusHistory(connection, {
      caseId: parsedCaseId,
      oldStatus,
      newStatus: "rejected",
      actorUserId: parsedActorUserId,
      reason: normalizedReason,
    });

    await connection.commit();
    transactionStarted = false;

    return {
      caseId: parsedCaseId,
      previousStatus: oldStatus,
      status: "rejected",
      message: "KYC application rejected successfully",
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
  getRecentKycApplications,
  getKycApplicationDetails,
  getKycApplicationDetailsByUserId,
  getKycDocumentAccess,
  approveKycApplication,
  rejectKycApplication
};

export {
  getKycApplications,
  getRecentKycApplications,
  getKycApplicationDetails,
  getKycApplicationDetailsByUserId,
  getKycDocumentAccess,
  approveKycApplication,
  rejectKycApplication
};

export default adminKycService;
