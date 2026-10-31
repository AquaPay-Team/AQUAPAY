import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import authModel from "./auth.model.js";
import recoveryDelivery from "./recoveryDelivery.js";
import ApiError from "../../utils/ApiError.js";
import { getAuthConfig, JWT_ISSUER, JWT_AUDIENCE } from "../../config/auth.js";

const AUTH_CONFIG = getAuthConfig();
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(32).toString("base64url"), AUTH_CONFIG.bcryptSaltRounds);
const RECOVERY_MESSAGE = "If the account exists and recovery delivery is available, instructions will be sent.";
const RESET_OTP_TTL_MINUTES = 5;

function hashResetOtp(token, otp) {
  return crypto
    .createHmac("sha256", AUTH_CONFIG.secret)
    .update(`aquapay:password-reset:otp:${token}:${otp}`)
    .digest("hex");
}

function resetOtpAttemptBucket(tokenHash) {
  return crypto
    .createHash("sha256")
    .update(`aquapay:password-reset:otp-attempts:${tokenHash}`)
    .digest("hex");
}

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
  const localDevelopment = process.env.NODE_ENV === "development";
  if (!localDevelopment && !recoveryDelivery.isConfigured(type)) {
    return { message: RECOVERY_MESSAGE };
  }
  const user = await withDatabase(() => authModel.findUserByIdentifier(identifier, type));
  if (!user || user.status !== "active") {
    return {
      message: RECOVERY_MESSAGE,
      ...(localDevelopment
        ? { developmentResetToken: crypto.randomBytes(32).toString("base64url") }
        : {}),
    };
  }

  const config = AUTH_CONFIG;
  const token = crypto.randomBytes(32).toString("base64url");
  const otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const otpHash = hashResetOtp(token, otp);
  const expiresAt = await withDatabase(() => authModel.createPasswordReset({
    userId: user.id,
    tokenHash,
    otpHash,
    ttlMinutes: config.resetTokenTtlMinutes,
    otpTtlMinutes: RESET_OTP_TTL_MINUTES,
  }));
  try {
    await recoveryDelivery.sendPasswordReset({
      destination: type === "email" ? user.email : user.mobile,
      type,
      token,
      otp,
      expiresAt
    });
  } catch {
    await authModel.invalidatePasswordReset(tokenHash).catch(() => {});
    return { message: RECOVERY_MESSAGE };
  }
  return {
    message: RECOVERY_MESSAGE,
    ...(localDevelopment ? { developmentResetToken: token } : {}),
  };
}

async function resetPassword({ token, otp, password }) {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const otpHash = hashResetOtp(token, otp);
  const attemptBucketHash = resetOtpAttemptBucket(tokenHash);
  const validCredentials = await withDatabase(() =>
    authModel.checkPasswordResetCredentials({
      tokenHash,
      otpHash,
      attemptBucketHash,
    }),
  );
  if (!validCredentials) {
    throw new ApiError(
      400,
      "Invalid or expired password reset credentials",
      "INVALID_RESET_CREDENTIALS",
    );
  }
  const config = AUTH_CONFIG;
  const passwordHash = await bcrypt.hash(password, config.bcryptSaltRounds);
  const account = await withDatabase(() => authModel.consumePasswordReset({
    tokenHash,
    otpHash,
    attemptBucketHash,
    passwordHash,
  }));
  if (!account) {
    throw new ApiError(
      400,
      "Invalid or expired password reset credentials",
      "INVALID_RESET_CREDENTIALS",
    );
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
