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

  const passwordConfig = getPasswordConfig();

  return {
    secret,
    expiresIn,
    bcryptSaltRounds: passwordConfig.bcryptSaltRounds,
    passwordMinLength: passwordConfig.passwordMinLength,
    resetTokenTtlMinutes: positiveInteger("AUTH_RESET_TOKEN_TTL_MINUTES", 15, 5, 60),
    rateLimits: {
      login: {
        windowSeconds: positiveInteger("AUTH_LOGIN_WINDOW_SECONDS", 900, 60, 86400),
        ip: positiveInteger("AUTH_LOGIN_IP_LIMIT", 60, 1),
        identifier: positiveInteger("AUTH_LOGIN_IDENTIFIER_LIMIT", 10, 1)
      },
      forgotPassword: {
        windowSeconds: positiveInteger("AUTH_RECOVERY_WINDOW_SECONDS", 3600, 60, 86400),
        ip: positiveInteger("AUTH_RECOVERY_IP_LIMIT", 30, 1),
        identifier: positiveInteger("AUTH_RECOVERY_IDENTIFIER_LIMIT", 5, 1)
      },
      resetPassword: {
        windowSeconds: positiveInteger("AUTH_RECOVERY_WINDOW_SECONDS", 3600, 60, 86400),
        ip: positiveInteger("AUTH_RECOVERY_IP_LIMIT", 30, 1),
        identifier: positiveInteger("AUTH_RESET_TOKEN_LIMIT", 10, 1)
      }
    }
  };
}

export { getAuthConfig, getPasswordConfig, JWT_ISSUER, JWT_AUDIENCE };

export default {
  getAuthConfig,
  getPasswordConfig,
  JWT_ISSUER,
  JWT_AUDIENCE,
};
