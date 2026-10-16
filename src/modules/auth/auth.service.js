const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const authModel = require("./auth.model");
const recoveryDelivery = require("./recoveryDelivery");
const ApiError = require("../../utils/ApiError");
const { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } = require("../../config/auth");

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
    company_name: user.company_name
  };
}

async function login({ identifier, type, password }) {
  const config = AUTH_CONFIG;
  const user = await withDatabase(() => authModel.findUserByIdentifier(identifier, type));
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
  const user = await withDatabase(() => authModel.findUserByIdentifier(identifier, type));
  if (!user || user.status !== "active") return { message: RECOVERY_MESSAGE };

  const config = AUTH_CONFIG;
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
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  if (!(await withDatabase(() => authModel.hasValidPasswordReset(tokenHash)))) {
    throw new ApiError(400, "Invalid or expired password reset token", "INVALID_RESET_TOKEN");
  }
  const config = AUTH_CONFIG;
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

module.exports = { login, getCurrentUser, forgotPassword, resetPassword };
