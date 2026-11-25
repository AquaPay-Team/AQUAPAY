
import jwt from "jsonwebtoken";
import authModel from "../modules/auth/auth.model.js";
import authSessionCache from "../modules/auth/authSessionCache.js";
import {
  isBlockedStatus,
  blockedAccountError,
} from "../modules/auth/accountStatus.js";
import ApiError from "../utils/ApiError.js";
import { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } from "../config/auth.js";

function unauthorized(message = "Authentication required") {
  return new ApiError(401, message, [], "UNAUTHORIZED");
}

function forbidden(message = "Admin access required") {
  return new ApiError(403, message, [], "FORBIDDEN");
}

function sessionTerminated() {
  return new ApiError(
    401,
    "Your session has been terminated. Please log in again.",
    [],
    "SESSION_TERMINATED",
  );
}

function authenticationUnavailable() {
  return new ApiError(
    503,
    "Authentication is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

async function requireAuth(req, res, next) {
  const header = req.get("authorization");
  const match =
    typeof header === "string"
      ? header.match(/^Bearer\s+(\S+)$/i)
      : null;

  if (!match) return next(unauthorized());

  let payload;

  try {
    payload = jwt.verify(match[1], getAuthConfig().secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
  } catch {
    return next(unauthorized("Invalid or expired access token"));
  }

  if (
    !payload ||
    typeof payload !== "object" ||
    typeof payload.sub !== "string" ||
    !/^[1-9]\d*$/.test(payload.sub) ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp)
  ) {
    return next(unauthorized("Invalid or expired access token"));
  }

  // An admin-initiated deactivation is remembered in-process so the very
  // next request from that account is rejected before any DB/cache read.
  if (authSessionCache.isAccountMarkedBlocked(payload.sub)) {
    return next(blockedAccountError());
  }

  let isActive;
  try {
    isActive = await authModel.isUserActive(payload.sub);
  } catch {
    return next(authenticationUnavailable());
  }

  if (!isActive) {
    // Distinguish an admin deactivation from an expired/deleted account so
    // the client gets the actionable blocked-account message.
    let authState = null;
    try {
      authState = await authModel.getUserAuthState(payload.sub);
    } catch {
      // Pre-migration schema or DB failure — keep the generic 401 below.
    }

    if (authState && isBlockedStatus(authState.status)) {
      authSessionCache.markAccountBlocked(payload.sub);
      return next(blockedAccountError());
    }

    return next(unauthorized("Invalid or expired access token"));
  }

  // Session generation is embedded in every token issued since migration 011.
  // Only tokens that carry it need the extra state read.
  if (Number.isFinite(payload.tv)) {
    let authState = null;
    try {
      authState = await authModel.getUserAuthState(payload.sub);
    } catch {
      // Migration not applied yet — treat tokens without enforcement.
    }

    if (authState && isBlockedStatus(authState.status)) {
      authSessionCache.markAccountBlocked(payload.sub);
      return next(blockedAccountError());
    }

    if (
      authState &&
      Number.isFinite(authState.tokenVersion) &&
      Number(payload.tv) !== authState.tokenVersion
    ) {
      return next(sessionTerminated());
    }
  }

  req.user = { id: payload.sub };
  return next();
}

async function requireAdmin(req, res, next) {
  if (!req.user?.id) {
    return next(unauthorized());
  }

  try {
    const isAdmin = await authModel.isAdmin(req.user.id);

    if (!isAdmin) {
      return next(forbidden());
    }

    return next();
  } catch {
    return next(
      new ApiError(
        503,
        "Authorization is temporarily unavailable",
        [],
        "SERVICE_UNAVAILABLE",
      ),
    );
  }
}

const authMiddleware = {
  requireAuth,
  requireAdmin,
};

export { requireAuth, requireAdmin };
export default authMiddleware;
