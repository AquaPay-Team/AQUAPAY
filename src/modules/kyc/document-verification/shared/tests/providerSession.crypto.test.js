import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";

import { createProviderSessionCrypto } from "../providerSession.crypto.js";

const TEST_ENV = {
  NODE_ENV: "test",
  KYC_PROVIDER_SESSION_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  KYC_PROVIDER_SESSION_TEST_ENCRYPTION_KEY_V1: randomBytes(32).toString("base64"),
};
const CONTEXT = {
  sessionId: "8f2e7a21-917b-4ce3-96ad-5209db9ac9aa",
  userId: "52",
  caseId: "13",
  verificationId: "31",
};

test("provider reference keys use AES-GCM with fresh IVs and are bound to the MySQL session", () => {
  const crypto = createProviderSessionCrypto({ env: TEST_ENV });
  const first = crypto.encryptReferenceKey("synthetic-reference-a", CONTEXT);
  const second = crypto.encryptReferenceKey("synthetic-reference-a", CONTEXT);
  assert.notDeepEqual(first.iv, second.iv);
  assert.equal(first.keyVersion, 1);
  assert.equal(crypto.decryptReferenceKey(first, CONTEXT), "synthetic-reference-a");
  assert.throws(() => crypto.decryptReferenceKey(first, { ...CONTEXT, userId: "53" }), /could not be authenticated/);
});

test("provider reference encryption rejects missing keys and authenticated-data tampering", () => {
  const missing = createProviderSessionCrypto({ env: { NODE_ENV: "test" } });
  assert.throws(() => missing.encryptReferenceKey("synthetic-reference", CONTEXT), {
    code: "PROVIDER_SESSION_ENCRYPTION_NOT_CONFIGURED",
  });

  const crypto = createProviderSessionCrypto({ env: TEST_ENV });
  const encrypted = crypto.encryptReferenceKey("synthetic-reference", CONTEXT);
  const changed = { ...encrypted, authenticationTag: Buffer.from(encrypted.authenticationTag) };
  changed.authenticationTag[0] ^= 1;
  assert.throws(() => crypto.decryptReferenceKey(changed, CONTEXT), /could not be authenticated/);
});
