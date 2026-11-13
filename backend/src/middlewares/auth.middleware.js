import jwt from "jsonwebtoken";
import authModel from "../modules/auth/auth.model.js";
import ApiError from "../utils/ApiError.js";
import { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } from "../config/auth.js";

function unauthorized(message = "Authentication required") {
  return new ApiError(401, message, "UNAUTHORIZED");
}

async function requireAuth(req, res, next) {
  const header = req.get("authorization");
  const match = typeof header === "string" ? header.match(/^Bearer\s+(\S+)$/i) : null;
  if (!match) return next(unauthorized());

  let payload;
  try {
    payload = jwt.verify(match[1], getAuthConfig().secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE
    });
  } catch {
    return next(unauthorized("Invalid or expired access token"));
  }

  if (!payload || typeof payload !== "object" || typeof payload.sub !== "string" || !/^[1-9]\d*$/.test(payload.sub) || !Number.isFinite(payload.iat) || !Number.isFinite(payload.exp)) {
    return next(unauthorized("Invalid or expired access token"));
  }

  try {
    if (!(await authModel.isUserActive(payload.sub))) {
      return next(unauthorized("Invalid or expired access token"));
    }
  } catch {
    return next(new ApiError(503, "Authentication is temporarily unavailable", "SERVICE_UNAVAILABLE"));
  }

  req.user = { id: payload.sub };
  return next();
}

const authMiddleware = {
  requireAuth,
};

export { requireAuth };
export default authMiddleware;
