import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { test } from "node:test";
import { assertIdentityEncryptionConfiguration, createIdentityDataCrypto } from "../identityData.crypto.js";
import { createIdentityDataModel } from "../identityData.model.js";

const KEY_V1 = randomBytes(32).toString("base64");
const KEY_V2 = randomBytes(32).toString("base64");
const TEST_ENV = Object.freeze({
  NODE_ENV: "test",
  KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  KYC_IDENTITY_TEST_ENCRYPTION_KEY_V1: KEY_V1,
});
const CONTEXT = Object.freeze({ userId: "7", caseId: "11", verificationId: "31" });
const AADHAAR_PAYLOAD = Object.freeze({
  aadhaarNumber: "999999999999",
  address: [{ line1: "42 Example Road", vtc: "Fictional Town", state: "Test State", country: "IN" }],
  dateOfBirth: "1990-01-01",
});

test("identity encryption uses unique AES-GCM IVs and decrypts Aadhaar and PAN payloads", () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  const first = crypto.encryptIdentityPayload("aadhaar", AADHAAR_PAYLOAD, CONTEXT);
  const second = crypto.encryptIdentityPayload("aadhaar", AADHAAR_PAYLOAD, CONTEXT);
  const pan = crypto.encryptIdentityPayload("pan", { panNumber: "AAAAA0000A" }, {
    ...CONTEXT,
    verificationId: "32",
  });

  assert.equal(first.iv.length, 12);
  assert.equal(first.authenticationTag.length, 16);
  assert.notDeepEqual(first.iv, second.iv);
  assert.equal(first.keyVersion, 1);
  assert.deepEqual(crypto.decryptIdentityPayload("aadhaar", first, CONTEXT), AADHAAR_PAYLOAD);
  assert.deepEqual(crypto.decryptIdentityPayload("pan", pan, { ...CONTEXT, verificationId: "32" }), {
    panNumber: "AAAAA0000A",
  });
});

test("identity encryption rejects missing configuration and invalid identity fields", () => {
  const missingKey = createIdentityDataCrypto({ env: {
    NODE_ENV: "test",
    KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  } });
  assert.throws(() => missingKey.encryptIdentityPayload("pan", { panNumber: "AAAAA0000A" }, CONTEXT), {
    code: "IDENTITY_ENCRYPTION_NOT_CONFIGURED",
  });
  assert.throws(() => assertIdentityEncryptionConfiguration({
    NODE_ENV: "test",
    KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  }), { code: "IDENTITY_ENCRYPTION_NOT_CONFIGURED" });
  assert.equal(assertIdentityEncryptionConfiguration(TEST_ENV), true);

  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  assert.throws(() => crypto.encryptIdentityPayload("aadhaar", {
    ...AADHAAR_PAYLOAD,
    aadhaarNumber: "1234",
  }, CONTEXT), { code: "INVALID_IDENTITY_DATA" });
  assert.throws(() => crypto.encryptIdentityPayload("aadhaar", {
    ...AADHAAR_PAYLOAD,
    address: [],
  }, CONTEXT), { code: "INVALID_IDENTITY_DATA" });
});

test("Aadhaar encryption accepts documented POA without optional country", () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  const payload = {
    ...AADHAAR_PAYLOAD,
    address: [{ line1: "Example Street", vtc: "Example Town", state: "Example State" }],
  };
  const encrypted = crypto.encryptIdentityPayload("aadhaar", payload, CONTEXT);
  assert.deepEqual(crypto.decryptIdentityPayload("aadhaar", encrypted, CONTEXT), payload);
});

test("Limited KYC masked Aadhaar identifier is encrypted distinctly and round-trips without a full number", () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  const payload = {
    aadhaarMaskedIdentifier: "XXXXXX9012",
    address: [{ line1: "Example Street", vtc: "Example Town", state: "Example State" }],
    dateOfBirth: "1990-01-01",
  };
  const encrypted = crypto.encryptIdentityPayload("aadhaar", payload, CONTEXT);

  assert.equal(encrypted.ciphertext.toString("utf8").includes("XXXXXX9012"), false);
  assert.deepEqual(crypto.decryptIdentityPayload("aadhaar", encrypted, CONTEXT), payload);
  assert.throws(() => crypto.encryptIdentityPayload("aadhaar", {
    ...payload,
    aadhaarNumber: "999999999999",
  }, CONTEXT), { code: "INVALID_IDENTITY_DATA" });
});

test("production cannot consume the local development encryption key", () => {
  const productionCrypto = createIdentityDataCrypto({ env: {
    NODE_ENV: "production",
    KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
    KYC_IDENTITY_DEV_ENCRYPTION_KEY_V1: KEY_V1,
  } });
  assert.throws(() => productionCrypto.encryptIdentityPayload("pan", { panNumber: "AAAAA0000A" }, CONTEXT), {
    code: "IDENTITY_ENCRYPTION_NOT_CONFIGURED",
  });
});

test("identity encryption rejects authentication-tag tampering, wrong keys, and cross-record use", () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  const encrypted = crypto.encryptIdentityPayload("aadhaar", AADHAAR_PAYLOAD, CONTEXT);
  const tamperedTag = { ...encrypted, authenticationTag: Buffer.from(encrypted.authenticationTag) };
  tamperedTag.authenticationTag[0] ^= 0xff;
  assert.throws(() => crypto.decryptIdentityPayload("aadhaar", tamperedTag, CONTEXT), {
    code: "IDENTITY_DATA_AUTHENTICATION_FAILED",
  });

  const wrongKeyCrypto = createIdentityDataCrypto({ env: {
    ...TEST_ENV,
    KYC_IDENTITY_TEST_ENCRYPTION_KEY_V1: KEY_V2,
  } });
  assert.throws(() => wrongKeyCrypto.decryptIdentityPayload("aadhaar", encrypted, CONTEXT), {
    code: "IDENTITY_DATA_AUTHENTICATION_FAILED",
  });
  assert.throws(() => crypto.decryptIdentityPayload("aadhaar", encrypted, { ...CONTEXT, userId: "8" }), {
    code: "IDENTITY_DATA_AUTHENTICATION_FAILED",
  });
});

test("identity encryption supports explicit key rotation while retaining old key versions", () => {
  const oldCrypto = createIdentityDataCrypto({ env: TEST_ENV });
  const encrypted = oldCrypto.encryptIdentityPayload("pan", { panNumber: "AAAAA0000A" }, CONTEXT);
  const rotatedCrypto = createIdentityDataCrypto({ env: {
    NODE_ENV: "test",
    KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "2",
    KYC_IDENTITY_TEST_ENCRYPTION_KEY_V1: KEY_V1,
    KYC_IDENTITY_TEST_ENCRYPTION_KEY_V2: KEY_V2,
  } });

  assert.equal(rotatedCrypto.encryptIdentityPayload("pan", { panNumber: "AAAAA0000A" }, CONTEXT).keyVersion, 2);
  assert.deepEqual(rotatedCrypto.decryptIdentityPayload("pan", encrypted, CONTEXT), { panNumber: "AAAAA0000A" });
});

test("identity model inserts encrypted payload with its user, case, and verification associations", async () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });
  const model = createIdentityDataModel({ encrypt: crypto.encryptIdentityPayload });
  const calls = [];
  const connection = {
    async execute(sql, values) { calls.push([sql, values]); return [{ affectedRows: 1 }]; },
  };
  await model.insertIdentityData(connection, {
    ...CONTEXT,
    identityType: "aadhaar",
    payload: AADHAAR_PAYLOAD,
  });

  assert.match(calls[0][0], /INSERT INTO kyc_identity_data/);
  assert.deepEqual(calls[0][1].slice(0, 4), ["7", "11", "31", "aadhaar"]);
  assert.equal(calls[0][1][4].toString("utf8").includes("999999999999"), false);
  assert.equal(calls[0][1][4].toString("utf8").includes("Example Road"), false);
  const decrypted = crypto.decryptIdentityPayload("aadhaar", {
    ciphertext: calls[0][1][4],
    iv: calls[0][1][5],
    authenticationTag: calls[0][1][6],
    keyVersion: calls[0][1][7],
  }, CONTEXT);
  assert.deepEqual(decrypted, AADHAAR_PAYLOAD);
});
