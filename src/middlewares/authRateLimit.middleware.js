import crypto from "node:crypto";
import authModel from "../modules/auth/auth.model.js";
import { getAuthConfig } from "../config/auth.js";
import { normalizeIdentifier } from "../modules/auth/auth.validator.js";
import ApiError from "../utils/ApiError.js";

function sqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function createRateLimiter({ incrementCounter = authModel.incrementRateLimitCounter } = {}) {
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
      const buckets = [{ kind: "ip", value: req.ip || req.socket?.remoteAddress || "unknown", maximum: policy.ip }];

      if (scope === "resetPassword") {
        const token = req.body?.token;
        if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
          buckets.push({ kind: "token", value: token, maximum: policy.identifier });
        }
      } else {
        const normalized = normalizeIdentifier(req.body?.identifier);
        if (normalized) buckets.push({ kind: "identifier", value: normalized.identifier, maximum: policy.identifier });
      }

      const key = crypto.createHmac("sha256", config.secret).update("aquapay-auth-rate-limits").digest();
      const counts = await Promise.all(buckets.map(({ kind, value }) => {
        const hash = crypto.createHmac("sha256", key).update(`${scope}:${kind}:${value}`).digest("hex");
        return incrementCounter(hash, windowStart, expiresAt);
      }));
      const exceeded = counts.findIndex((count, index) => count > buckets[index].maximum);
      if (exceeded !== -1) {
        const retryAfter = Math.max(1, Math.ceil((windowStartMs + windowMs - now) / 1000));
        res.set("Retry-After", String(retryAfter));
        return next(new ApiError(429, "Too many authentication attempts. Try again later.", "RATE_LIMITED"));
      }
      return next();
    } catch {
      console.error("Authentication rate-limit storage unavailable");
      return next(new ApiError(503, "Authentication is temporarily unavailable", "SERVICE_UNAVAILABLE"));
    }
  };
}

const rateLimit = createRateLimiter();

export { rateLimit, createRateLimiter };
export default { rateLimit, createRateLimiter };
