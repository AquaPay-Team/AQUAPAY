import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const FORMAT_VERSION = 1;

function getEncryptionKey() {
  const encodedKey = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;

  if (!encodedKey) {
    throw new Error("Bank account encryption key is not configured");
  }

  const key = Buffer.from(encodedKey, "base64");

  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error(
      "Bank account encryption key must be a valid 32-byte base64 key",
    );
  }

  return key;
}

function encryptAccountNumber(accountNumber) {
  if (typeof accountNumber !== "string" || !/^\d{9,18}$/.test(accountNumber)) {
    throw new Error("Invalid bank account number");
  }

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([
    cipher.update(accountNumber, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: version (1 byte) + IV (12 bytes) + auth tag (16 bytes) + ciphertext
  return Buffer.concat([
    Buffer.from([FORMAT_VERSION]),
    iv,
    authTag,
    ciphertext,
  ]);
}

function decryptAccountNumber(encryptedData) {
  if (!Buffer.isBuffer(encryptedData) || encryptedData.length < 30) {
    throw new Error("Invalid encrypted bank account data");
  }

  const version = encryptedData[0];

  if (version !== FORMAT_VERSION) {
    throw new Error("Unsupported bank account encryption format");
  }

  const key = getEncryptionKey();

  const iv = encryptedData.subarray(1, 13);
  const authTag = encryptedData.subarray(13, 29);
  const ciphertext = encryptedData.subarray(29);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

export { encryptAccountNumber, decryptAccountNumber };
