import getUserModel from "../../users/get-user/get-user.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ACCOUNT_STATUSES = new Set(["active", "inactive", "blocked"]);
const ISO_INSTANT = /^(\d{4})-(\d{2})-(\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function validationError(message) {
  return new ApiError(
    httpStatus.BAD_REQUEST,
    message,
    [],
    "VALIDATION_ERROR",
  );
}

function readSingleQueryValue(value, fieldName) {
  if (Array.isArray(value)) {
    throw validationError(`${fieldName} must be provided once`);
  }
  return value;
}

function parsePositiveInteger(value, fieldName, { defaultValue, max } = {}) {
  const raw = readSingleQueryValue(value, fieldName);
  if (raw === undefined || raw === "") return defaultValue;

  if (
    typeof raw !== "string" ||
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1 ||
    (max !== undefined && Number(raw) > max)
  ) {
    throw validationError(
      max === undefined
        ? `${fieldName} must be a positive integer`
        : `${fieldName} must be a positive integer no greater than ${max}`,
    );
  }

  return Number(raw);
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

function parseSearch(value) {
  const raw = readSingleQueryValue(value, "search");
  if (raw === undefined || raw === "") return { userId: null, nameSearch: null };
  if (typeof raw !== "string") throw validationError("search must be a string");

  const search = raw.trim();
  if (!search) return { userId: null, nameSearch: null };
  if (search.length > 100) {
    throw validationError("search must not exceed 100 characters");
  }

  if (/^\d+$/.test(search)) {
    const userId = Number(search);
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw validationError("search User ID must be a positive integer");
    }
    return { userId, nameSearch: null };
  }

  return { userId: null, nameSearch: search };
}

function parseStatus(value) {
  const raw = readSingleQueryValue(value, "status");
  if (raw === undefined || raw === "") return null;
  if (typeof raw !== "string" || !ACCOUNT_STATUSES.has(raw)) {
    throw validationError("status must be active, inactive, or blocked");
  }
  return raw;
}

function getPagination(page, limit, total) {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

async function getAdminUsers(query = {}) {
  const page = parsePositiveInteger(query.page, "page", {
    defaultValue: DEFAULT_PAGE,
  });
  const limit = parsePositiveInteger(query.limit, "limit", {
    defaultValue: DEFAULT_LIMIT,
    max: MAX_LIMIT,
  });
  const { userId, nameSearch } = parseSearch(query.search);
  const status = parseStatus(query.status);
  const roleId = parsePositiveInteger(query.roleId, "roleId");
  const registeredFrom = parseOptionalIsoInstant(
    query.registeredFrom,
    "registeredFrom",
  );
  const registeredTo = parseOptionalIsoInstant(
    query.registeredTo,
    "registeredTo",
  );

  if (registeredFrom && registeredTo && registeredFrom >= registeredTo) {
    throw validationError("registeredFrom must be before registeredTo");
  }

  const result = await getUserModel.findAdminUsersPage({
    userId,
    nameSearch,
    status,
    roleId,
    registeredFrom,
    registeredTo,
    page,
    limit,
  });

  return {
    users: result.users,
    pagination: getPagination(page, limit, result.total),
  };
}

export { getAdminUsers };
export default { getAdminUsers };
