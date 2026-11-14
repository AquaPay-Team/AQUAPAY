import crypto from "node:crypto";
import authModel from "../modules/auth/auth.model.js";
import { getAuthConfig } from "../config/auth.js";
import { normalizeIdentifier } from "../modules/auth/auth.validator.js";
import { normalizeMobile } from "../utils/validationHelper.js";
import ApiError from "../utils/ApiError.js";
import logger from "../utils/logger.js";

function sqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function hashRateLimitBucket(secret, scope, kind, value) {
  const key = crypto
    .createHmac("sha256", secret)
    .update("aquapay-auth-rate-limits")
    .digest();
  return crypto
    .createHmac("sha256", key)
    .update(`${scope}:${kind}:${value}`)
    .digest("hex");
}

function createRateLimiter({ incrementCounter, readCounter } = {}) {
  const increment = incrementCounter || authModel.incrementRateLimitCounter;
  const legacyRead = readCounter || (incrementCounter ? null : authModel.getRateLimitCounter);
  return (scope) => async (req, res, next) => {
    try {
      const config = getAuthConfig();
      const policy = config.rateLimits[scope];
      if (!policy) throw new Error("Unknown authentication rate-limit scope");
      const now = Date.now();
      const windowMs = policy.windowSeconds * 1000;
      const windowStartMs = Math.floor(now / windowMs) * windowMs;
      const windowStart = sqlDate(new Date(windowStartMs));
      const expiresAt = sqlDate(new Date(windowStartMs + windowMs * 2));
      const buckets = [
        {
          kind: "ip",
          value: req.ip || req.socket?.remoteAddress || "unknown",
          maximum: policy.ip,
        },
      ];

      if (policy.user) {
        if (req.user?.id === undefined || req.user?.id === null) {
          return next(
            new ApiError(401, "Authentication required", "UNAUTHORIZED"),
          );
        }

        buckets.push({
          kind: "user",
          value: String(req.user.id),
          maximum: policy.user,
        });
      }
      if (scope === "resetPassword") {
        const token = req.body?.token;

        if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
          buckets.push({
            kind: "token",
            value: token,
            maximum: policy.identifier,
          });
        }
      } else if (policy.identifier) {
        const normalized = normalizeIdentifier(req.body?.identifier);

        if (normalized) {
          const identifier = normalized.type === "mobile"
            ? normalizeMobile(normalized.identifier)
            : normalized.identifier;
          // Login/recovery throttles are scoped to the source IP as well as the
          // normalized identifier. A caller cannot lock a victim out merely by
          // exhausting a bucket shared by every network location.
          const bucketValue = scope === "login" || scope === "forgotPassword"
            ? `${req.ip || req.socket?.remoteAddress || "unknown"}\u0000${identifier}`
            : identifier;
          buckets.push({
            kind: "identifier",
            value: bucketValue,
            maximum: policy.identifier,
          });
        }
      }

      const counts = await Promise.all(buckets.map(async ({ kind, value }) => {
        const currentHash = hashRateLimitBucket(config.rateLimitHmacSecret, scope, kind, value);
        const currentCount = await increment(currentHash, windowStart, expiresAt);
        // Keep honoring unexpired counters written with the former JWT-derived
        // key. Login/recovery identifiers changed scope to include source IP,
        // so legacy global identifier counters are deliberately not consulted.
        const legacyApplies = legacyRead && !(
          (scope === "login" || scope === "forgotPassword") && kind === "identifier"
        );
        const legacyCount = legacyApplies
          ? await legacyRead(hashRateLimitBucket(config.secret, scope, kind, value), windowStart)
          : 0;
        return currentCount + legacyCount;
      }));
      const exceeded = counts.findIndex((count, index) => count > buckets[index].maximum);
      if (exceeded !== -1) {
        const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000));
        res.set("Retry-After", String(retryAfter));
        return next(
          new ApiError(429, "Too many requests. Try again later.", "RATE_LIMITED"),
        );
      }
      return next();
    } catch {
      logger.error("auth.rate_limit_storage_unavailable", { scope });

      return next(
        new ApiError(
          503,
          "Service is temporarily unavailable",
          "SERVICE_UNAVAILABLE",
        ),
      );
    }
  };
}

const rateLimit = createRateLimiter();

export { rateLimit, createRateLimiter, hashRateLimitBucket };
export default { rateLimit, createRateLimiter };
