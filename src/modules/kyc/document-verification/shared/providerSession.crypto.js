import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

function configurationError() {
  const error = new Error("Provider session encryption is not configured");
  error.code = "PROVIDER_SESSION_ENCRYPTION_NOT_CONFIGURED";
  return error;
}

function environmentName(env) {
  if (env.NODE_ENV === "development") return "DEV";
  if (env.NODE_ENV === "test") return "TEST";
  if (env.NODE_ENV === "production") return "PROD";
  throw configurationError();
}

function activeKeyVersion(env) {
  const value = String(env.KYC_PROVIDER_SESSION_ENCRYPTION_ACTIVE_KEY_VERSION ?? "").trim();
  if (!/^[1-9]\d{0,4}$/.test(value) || Number(value) > 65535) throw configurationError();
  return Number(value);
}

function resolveKey(env, version) {
  const variable = `KYC_PROVIDER_SESSION_${environmentName(env)}_ENCRYPTION_KEY_V${version}`;
  const encoded = env[variable];
  if (typeof encoded !== "string" || !encoded.trim()) throw configurationError();
  const normalized = encoded.trim();
  const key = Buffer.from(normalized, "base64");
  if (key.length !== 32 || key.toString("base64") !== normalized) throw configurationError();
  return key;
}

function contextBytes(context, keyVersion) {
  const fields = ["sessionId", "userId", "caseId", "verificationId"];
  if (!context || fields.some((field) => !/^[A-Za-z0-9-]{1,64}$/.test(String(context[field] ?? "")))) {
    throw new Error("Provider session context is invalid");
  }
  return Buffer.from(JSON.stringify({
    purpose: "idto-reference-key",
    sessionId: String(context.sessionId),
    userId: String(context.userId),
    caseId: String(context.caseId),
    verificationId: String(context.verificationId),
    keyVersion,
  }), "utf8");
}

function validateReferenceKey(value) {
  return typeof value === "string" && value.length > 0 && value.length <= 4096 &&
    value === value.trim() && !/[\u0000-\u001f\u007f]/.test(value);
}

function createProviderSessionCrypto({ env = process.env, random = randomBytes } = {}) {
  function encryptReferenceKey(referenceKey, context) {
    if (!validateReferenceKey(referenceKey)) throw new Error("Provider reference key is invalid");
    const version = activeKeyVersion(env);
    const key = resolveKey(env, version);
    const iv = random(IV_BYTES);
    if (!Buffer.isBuffer(iv) || iv.length !== IV_BYTES) throw new Error("Secure random IV generation failed");
    const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    cipher.setAAD(contextBytes(context, version));
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(referenceKey, "utf8")),
      cipher.final(),
    ]);
    return { ciphertext, iv, authenticationTag: cipher.getAuthTag(), keyVersion: version };
  }

  function decryptReferenceKey(encrypted, context) {
    const version = Number(encrypted?.keyVersion);
    if (!Number.isInteger(version) || version < 1 || version > 65535) throw configurationError();
    const key = resolveKey(env, version);
    const iv = Buffer.from(encrypted?.iv || []);
    const tag = Buffer.from(encrypted?.authenticationTag || []);
    const ciphertext = Buffer.from(encrypted?.ciphertext || []);
    if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES || !ciphertext.length) {
      throw new Error("Provider reference key could not be authenticated");
    }
    try {
      const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
      decipher.setAAD(contextBytes(context, version));
      decipher.setAuthTag(tag);
      const cleartext = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
      if (!validateReferenceKey(cleartext)) throw new Error("invalid reference");
      return cleartext;
    } catch {
      throw new Error("Provider reference key could not be authenticated");
    }
  }

  function assertProviderSessionEncryptionConfiguration() {
    const version = activeKeyVersion(env);
    const key = resolveKey(env, version);
    key.fill(0);
    return true;
  }

  return Object.freeze({
    encryptReferenceKey,
    decryptReferenceKey,
    assertProviderSessionEncryptionConfiguration,
  });
}

const defaultCrypto = createProviderSessionCrypto();

export const encryptReferenceKey = defaultCrypto.encryptReferenceKey;
export const decryptReferenceKey = defaultCrypto.decryptReferenceKey;
export const assertProviderSessionEncryptionConfiguration = defaultCrypto.assertProviderSessionEncryptionConfiguration;
export { createProviderSessionCrypto };
export default { encryptReferenceKey, decryptReferenceKey };
