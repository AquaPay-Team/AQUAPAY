import ApiError from "../../utils/ApiError.js";

/** Shared blocked-account semantics for login, token refresh and middleware. */
const BLOCKED_ACCOUNT_MESSAGE =
  "Your account is blocked. Please contact the administrator.";

const BLOCKED_STATUSES = new Set(["inactive", "blocked"]);

function isBlockedStatus(status) {
  return BLOCKED_STATUSES.has(String(status || "").toLowerCase());
}

function blockedAccountError() {
  return new ApiError(
    403,
    BLOCKED_ACCOUNT_MESSAGE,
    [],
    "ACCOUNT_BLOCKED",
  );
}

export {
  BLOCKED_ACCOUNT_MESSAGE,
  isBlockedStatus,
  blockedAccountError,
};

export default {
  BLOCKED_ACCOUNT_MESSAGE,
  isBlockedStatus,
  blockedAccountError,
};
