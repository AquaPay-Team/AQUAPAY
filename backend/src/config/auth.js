import crypto from "node:crypto";

const JWT_ISSUER = "aquapay-api";
const JWT_AUDIENCE = "aquapay-client";

function positiveInteger(name, fallback, min, max = 10000) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  if (!/^[1-9]\d*$/.test(raw)) throw new Error(`${name} must be a positive integer`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be between ${min} and ${max}`);
  }
  return value;
}

function getPasswordConfig() {
  return {
    bcryptSaltRounds: positiveInteger("AUTH_BCRYPT_SALT_ROUNDS", 12, 10, 15),
    passwordMinLength: positiveInteger("AUTH_PASSWORD_MIN_LENGTH", 8, 8, 72),
  };
}

function purposeSecret(envName, jwtSecret, purpose, environment) {
  const configured = process.env[envName];
  if (configured !== undefined && configured !== "") {
    if (typeof configured !== "string" || configured.length < 32 || /replace|example|placeholder/i.test(configured)) {
      throw new Error(`${envName} must be a unique, non-placeholder value of at least 32 characters`);
    }
    return configured;
  }
  if (environment === "production") {
    throw new Error(`${envName} is required in production`);
  }
  return crypto.hkdfSync("sha256", Buffer.from(jwtSecret), Buffer.alloc(0), `aquapay:${purpose}:v1`, 32);
}

function getAuthConfig() {
  const secret = process.env.JWT_SECRET;
  const expiresIn = process.env.JWT_EXPIRES_IN || "1h";
  if (typeof secret !== "string" || secret.length < 32 || /replace|example|placeholder/i.test(secret)) {
    throw new Error("JWT_SECRET must be a unique, non-placeholder value of at least 32 characters");
  }
  const duration = /^([1-9]\d*)([smhd])$/.exec(expiresIn);
  const durationSeconds = duration && Number(duration[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[duration[2]]);
  if (!duration || !Number.isSafeInteger(durationSeconds) || durationSeconds > 365 * 86400) {
    throw new Error("JWT_EXPIRES_IN must be a positive duration no longer than 365 days");
  }

  const environment = process.env.NODE_ENV || "development";
  const developmentSecretsFlag = process.env.AUTH_ALLOW_DEVELOPMENT_SECRETS || "false";
  if (!["true", "false"].includes(developmentSecretsFlag)) {
    throw new Error("AUTH_ALLOW_DEVELOPMENT_SECRETS must be true or false");
  }
  if (developmentSecretsFlag === "true" && environment !== "development") {
    throw new Error("AUTH_ALLOW_DEVELOPMENT_SECRETS can only be enabled in development");
  }
  const developmentSecretsEnabled = developmentSecretsFlag === "true";
  const otpHmacSecret = purposeSecret("AUTH_OTP_HMAC_SECRET", secret, "password-reset-otp", environment);
  const rateLimitHmacSecret = purposeSecret("AUTH_RATE_LIMIT_HMAC_SECRET", secret, "rate-limit-buckets", environment);
  const secretBytes = Buffer.from(secret);
  const otpSecretBytes = Buffer.from(otpHmacSecret);
  const rateLimitSecretBytes = Buffer.from(rateLimitHmacSecret);
  if (
    (secretBytes.length === otpSecretBytes.length && crypto.timingSafeEqual(secretBytes, otpSecretBytes)) ||
    (secretBytes.length === rateLimitSecretBytes.length && crypto.timingSafeEqual(secretBytes, rateLimitSecretBytes)) ||
    (otpSecretBytes.length === rateLimitSecretBytes.length && crypto.timingSafeEqual(otpSecretBytes, rateLimitSecretBytes))
  ) {
    throw new Error("JWT, OTP HMAC, and rate-limit HMAC secrets must be distinct");
  }

  const passwordConfig = getPasswordConfig();

  return {
    secret,
    otpHmacSecret,
    rateLimitHmacSecret,
    developmentSecretsEnabled,
    expiresIn,
    bcryptSaltRounds: passwordConfig.bcryptSaltRounds,
    passwordMinLength: passwordConfig.passwordMinLength,
    resetTokenTtlMinutes: positiveInteger("AUTH_RESET_TOKEN_TTL_MINUTES", 15, 5, 60),
    rateLimits: {
  login: {
    windowSeconds: positiveInteger("AUTH_LOGIN_WINDOW_SECONDS", 900, 60, 86400),
    ip: positiveInteger("AUTH_LOGIN_IP_LIMIT", 60, 1),
    identifier: positiveInteger("AUTH_LOGIN_IDENTIFIER_LIMIT", 10, 1),
  },
  forgotPassword: {
    windowSeconds: positiveInteger("AUTH_RECOVERY_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("AUTH_RECOVERY_IP_LIMIT", 30, 1),
    identifier: positiveInteger("AUTH_RECOVERY_IDENTIFIER_LIMIT", 5, 1),
  },
  resetPassword: {
    windowSeconds: positiveInteger("AUTH_RECOVERY_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("AUTH_RECOVERY_IP_LIMIT", 30, 1),
    identifier: positiveInteger("AUTH_RESET_TOKEN_LIMIT", 10, 1),
  },
  panVerification: {
    windowSeconds: positiveInteger("KYC_PAN_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("KYC_PAN_IP_LIMIT", 30, 1),
    user: positiveInteger("KYC_PAN_USER_LIMIT", 5, 1),
  },
  bankVerification: {
    windowSeconds: positiveInteger("KYC_BANK_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("KYC_BANK_IP_LIMIT", 30, 1),
    user: positiveInteger("KYC_BANK_USER_LIMIT", 5, 1),
    case: positiveInteger("KYC_BANK_CASE_LIMIT", 5, 1),
  },
  digilockerInitiation: {
    windowSeconds: positiveInteger("KYC_DIGILOCKER_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("KYC_DIGILOCKER_IP_LIMIT", 30, 1),
    user: positiveInteger("KYC_DIGILOCKER_USER_LIMIT", 5, 1),
  },
  mediaUpload: {
    windowSeconds: positiveInteger("KYC_MEDIA_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("KYC_MEDIA_IP_LIMIT", 60, 1),
    user: positiveInteger("KYC_MEDIA_USER_LIMIT", 10, 1),
  },
  userCreation: {
    windowSeconds: positiveInteger("USER_CREATION_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("USER_CREATION_IP_LIMIT", 30, 1),
    user: positiveInteger("USER_CREATION_USER_LIMIT", 5, 1),
  },
  adminCreation: {
    windowSeconds: positiveInteger("ADMIN_CREATION_WINDOW_SECONDS", 3600, 60, 86400),
    ip: positiveInteger("ADMIN_CREATION_IP_LIMIT", 5, 1),
  },
},
    }
  };

export { getAuthConfig, getPasswordConfig, JWT_ISSUER, JWT_AUDIENCE };

export default {
  getAuthConfig,
  getPasswordConfig,
  JWT_ISSUER,
  JWT_AUDIENCE,
};
