import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authModel from "./auth.model.js";
import recoveryDelivery from "./recoveryDelivery.js";
import ApiError from "../../utils/ApiError.js";
import { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } from "../../config/auth.js";
import { normalizeMobile } from "../../utils/validationHelper.js";

const AUTH_CONFIG = getAuthConfig();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("base64url"), AUTH_CONFIG.bcryptSaltRounds);
const RECOVERY_MESSAGE = "If the account exists and recovery delivery is available, instructions will be sent.";

function authFailure() {
  return new ApiError(401, "Invalid email/mobile or password", "INVALID_CREDENTIALS");
}

async function withDatabase(operation) {
  try {
    return await operation();
  } catch {
    throw new ApiError(503, "Authentication is temporarily unavailable", "SERVICE_UNAVAILABLE");
  }
}

function safeUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role_id: user.role_id,
    company_id: user.company_id,
    parent_id: user.parent_id,
    status: user.status,
    role_name: user.role_name,
    company_name: user.company_name,
    kyc: user.kyc ?? null,
  };
}

async function login({ identifier, type, password }) {
  const config = getAuthConfig();
  const lookupIdentifier = type === "mobile" ? normalizeMobile(identifier) : identifier;
  const user = await withDatabase(() => authModel.findUserByIdentifier(lookupIdentifier, type));
  let passwordMatches = false;
  try {
    passwordMatches = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
  } catch {
    passwordMatches = false;
  }
  if (!user || user.status !== "active" || !passwordMatches) throw authFailure();

  const accessToken = jwt.sign({}, config.secret, {
    algorithm: "HS256",
    audience: JWT_AUDIENCE,
    expiresIn: config.expiresIn,
    issuer: JWT_ISSUER,
    subject: String(user.id)
  });
  return { accessToken, tokenType: "Bearer", expiresIn: config.expiresIn, user: safeUser(user) };
}

async function getCurrentUser(userId) {
  const user = await withDatabase(() => authModel.findActiveUserById(userId));
  if (!user) throw new ApiError(401, "Invalid or expired access token", "UNAUTHORIZED");
  return safeUser(user);
}

async function forgotPassword({ identifier, type }) {
  if (!recoveryDelivery.isConfigured(type)) return { message: RECOVERY_MESSAGE };
  const lookupIdentifier = type === "mobile" ? normalizeMobile(identifier) : identifier;
  const user = await withDatabase(() => authModel.findUserByIdentifier(lookupIdentifier, type));
  if (!user || user.status !== "active") return { message: RECOVERY_MESSAGE };

  const config = getAuthConfig();
  const token = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = await withDatabase(() => authModel.createPasswordReset({
    userId: user.id,
    tokenHash,
    ttlMinutes: config.resetTokenTtlMinutes
  }));
  try {
    await recoveryDelivery.sendPasswordReset({
      destination: type === "email" ? user.email : user.mobile,
      type,
      token,
      expiresAt
    });
  } catch {
    await authModel.invalidatePasswordReset(tokenHash).catch(() => {});
  }
  return { message: RECOVERY_MESSAGE };
}

async function resetPassword({ token, password }) {
  const config = getAuthConfig();
  if (
    typeof password !== "string" ||
    password.length < config.passwordMinLength ||
    Buffer.byteLength(password, "utf8") > 72
  ) {
    throw new ApiError(
      400,
      typeof password !== "string" || !password
        ? "Password is required"
        : password.length < config.passwordMinLength
          ? `Password must contain at least ${config.passwordMinLength} characters`
          : "Password must not exceed 72 bytes",
      "VALIDATION_ERROR",
    );
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (!(await withDatabase(() => authModel.hasValidPasswordReset(tokenHash)))) {
    throw new ApiError(400, "Invalid or expired password reset token", "INVALID_RESET_TOKEN");
  }
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const account = await withDatabase(() => authModel.consumePasswordReset({ tokenHash, passwordHash }));
  if (!account) {
    throw new ApiError(400, "Invalid or expired password reset token", "INVALID_RESET_TOKEN");
  }
  if (recoveryDelivery.isConfigured()) {
    await recoveryDelivery.sendPasswordChanged(account).catch(() => {});
  }
  return { message: "Password reset successfully" };
}

const authService = {
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};

export {
  login,
  getCurrentUser,
  forgotPassword,
  resetPassword,
};

export default authService;
