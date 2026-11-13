import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_ADDRESS_FIELD_LENGTH = 500;
const ADDRESS_FIELDS = Object.freeze([
  "type",
  "line1",
  "line2",
  "house",
  "landmark",
  "locality",
  "vtc",
  "district",
  "pin",
  "state",
  "country",
]);

function invalidIdentityData() {
  const error = new Error("Identity data is invalid");
  error.code = "INVALID_IDENTITY_DATA";
  return error;
}

function identityAad({ userId, caseId, verificationId, identityType, keyVersion }) {
  if (!userId || !caseId || !verificationId || !["aadhaar", "pan"].includes(identityType)) {
    throw invalidIdentityData();
  }
  return Buffer.from(
    JSON.stringify({
      userId: String(userId),
      caseId: String(caseId),
      verificationId: String(verificationId),
      identityType,
      keyVersion,
    }),
    "utf8",
  );
}

function validateAddress(address) {
  if (!Array.isArray(address) || address.length < 1 || address.length > 8) throw invalidIdentityData();
  for (const entry of address) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw invalidIdentityData();
    const keys = Object.keys(entry);
    if (keys.some((key) => !ADDRESS_FIELDS.includes(key))) throw invalidIdentityData();
    for (const key of keys) {
      if (typeof entry[key] !== "string" || entry[key].length > MAX_ADDRESS_FIELD_LENGTH || /[\u0000-\u001f\u007f]/.test(entry[key])) {
        throw invalidIdentityData();
      }
    }
    // Country is optional in the documented IDTO POA structure; the address
    // still requires a line, VTC, and state for AquaPay's KYC identity record.
    if (!["line1", "vtc", "state"].every((key) => entry[key]?.trim())) {
      throw invalidIdentityData();
    }
  }
}

function validateIdentityPayload(identityType, payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw invalidIdentityData();
  if (identityType === "aadhaar") {
    const hasAadhaarNumber = Object.hasOwn(payload, "aadhaarNumber");
    const hasMaskedAadhaarIdentifier = Object.hasOwn(payload, "aadhaarMaskedIdentifier");
    const validAadhaarNumber = hasAadhaarNumber && typeof payload.aadhaarNumber === "string" && /^\d{12}$/.test(payload.aadhaarNumber);
    const validMaskedAadhaarIdentifier = hasMaskedAadhaarIdentifier &&
      typeof payload.aadhaarMaskedIdentifier === "string" && /^[X*]{4,8}\d{4}$/.test(payload.aadhaarMaskedIdentifier);
    if (
      Object.keys(payload).some((key) => !["aadhaarNumber", "aadhaarMaskedIdentifier", "address", "dateOfBirth"].includes(key)) ||
      validAadhaarNumber === validMaskedAadhaarIdentifier ||
      (hasAadhaarNumber && !validAadhaarNumber) ||
      (hasMaskedAadhaarIdentifier && !validMaskedAadhaarIdentifier) ||
      typeof payload.dateOfBirth !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dateOfBirth)
    ) throw invalidIdentityData();
    const [year, month, day] = payload.dateOfBirth.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw invalidIdentityData();
    }
    validateAddress(payload.address);
    return;
  }
  if (
    identityType === "pan" &&
    Object.keys(payload).length === 1 &&
    typeof payload.panNumber === "string" &&
    /^[A-Z]{5}\d{4}[A-Z]$/.test(payload.panNumber)
  ) return;
  throw invalidIdentityData();
}

function resolveKeyConfiguration(env, keyVersion) {
  const environmentName = env.NODE_ENV === "development"
    ? "DEV"
    : env.NODE_ENV === "test"
      ? "TEST"
      : "PROD";
  const variableName = `KYC_IDENTITY_${environmentName}_ENCRYPTION_KEY_V${keyVersion}`;
  const encoded = env[variableName];
  if (typeof encoded !== "string" || !encoded.trim()) {
    const error = new Error("Identity encryption key is not configured");
    error.code = "IDENTITY_ENCRYPTION_NOT_CONFIGURED";
    throw error;
  }
  const normalized = encoded.trim();
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64") !== normalized) {
    const error = new Error("Identity encryption key configuration is invalid");
    error.code = "IDENTITY_ENCRYPTION_NOT_CONFIGURED";
    throw error;
  }
  return key;
}

function getActiveKeyVersion(env) {
  const value = String(env.KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION ?? "").trim();
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) {
    const error = new Error("Identity encryption key version is not configured");
    error.code = "IDENTITY_ENCRYPTION_NOT_CONFIGURED";
    throw error;
  }
  return Number(value);
}

function assertIdentityEncryptionConfiguration(env = process.env) {
  const key = resolveKeyConfiguration(env, getActiveKeyVersion(env));
  key.fill(0);
  return true;
}

function createIdentityDataCrypto({ env = process.env, random = randomBytes } = {}) {
  function encryptIdentityPayload(identityType, payload, context) {
    validateIdentityPayload(identityType, payload);
    const keyVersion = getActiveKeyVersion(env);
    const key = resolveKeyConfiguration(env, keyVersion);
    const iv = random(IV_BYTES);
    if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) throw new Error("Secure random IV generation failed");
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(identityAad({ ...context, identityType, keyVersion }));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(JSON.stringify(payload), "utf8")),
      cipher.final(),
    ]);
    return { ciphertext, iv, authenticationTag: cipher.getAuthTag(), keyVersion };
  }

  function decryptIdentityPayload(identityType, encrypted, context) {
    const keyVersion = Number(encrypted?.keyVersion);
    if (!Number.isInteger(keyVersion) || keyVersion < 1 || keyVersion > 65535) throw invalidIdentityData();
    const key = resolveKeyConfiguration(env, keyVersion);
    const iv = Buffer.from(encrypted?.iv || []);
    const authenticationTag = Buffer.from(encrypted?.authenticationTag || []);
    const ciphertext = Buffer.from(encrypted?.ciphertext || []);
    if (iv.length !== IV_BYTES || authenticationTag.length !== TAG_BYTES || !ciphertext.length) throw invalidIdentityData();

    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(identityAad({ ...context, identityType, keyVersion }));
      decipher.setAuthTag(authenticationTag);
      const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const payload = JSON.parse(plaintext.toString("utf8"));
      validateIdentityPayload(identityType, payload);
      return payload;
    } catch {
      const error = new Error("Identity data could not be authenticated");
      error.code = "IDENTITY_DATA_AUTHENTICATION_FAILED";
      throw error;
    }
  }

  return Object.freeze({ encryptIdentityPayload, decryptIdentityPayload });
}

const defaultCrypto = createIdentityDataCrypto();

export const encryptIdentityPayload = defaultCrypto.encryptIdentityPayload;
export const decryptIdentityPayload = defaultCrypto.decryptIdentityPayload;
export { assertIdentityEncryptionConfiguration, createIdentityDataCrypto, validateIdentityPayload };
export default { encryptIdentityPayload, decryptIdentityPayload };
