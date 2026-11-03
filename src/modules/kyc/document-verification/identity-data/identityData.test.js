import assert from "node:assert/strict";
import { test } from "node:test";
import { createIdentityDataCrypto } from "./identityData.crypto.js";

import { randomBytes } from "node:crypto";

const KEY_V1 = randomBytes(32).toString("base64");

const TEST_ENV = Object.freeze({
  NODE_ENV: "test",
  KYC_IDENTITY_ENCRYPTION_ACTIVE_KEY_VERSION: "1",
  KYC_IDENTITY_TEST_ENCRYPTION_KEY_V1: KEY_V1,
});

const CONTEXT = Object.freeze({
  userId: "7",
  caseId: "11",
  verificationId: "31",
});
const IDTO_AADHAAR_PAYLOAD = Object.freeze({
  dateOfBirth: "1990-01-01",
  gender: "M",
  eaadhaar: "Y",
  verificationMode: "idto_user_details",
});

test("identity encryption accepts and decrypts minimal IDTO Aadhaar payload", () => {
  const crypto = createIdentityDataCrypto({ env: TEST_ENV });

  const encrypted = crypto.encryptIdentityPayload(
    "aadhaar",
    IDTO_AADHAAR_PAYLOAD,
    CONTEXT,
  );

  assert.deepEqual(
    crypto.decryptIdentityPayload("aadhaar", encrypted, CONTEXT),
    IDTO_AADHAAR_PAYLOAD,
  );

  assert.throws(
    () =>
      crypto.encryptIdentityPayload(
        "aadhaar",
        {
          ...IDTO_AADHAAR_PAYLOAD,
          verificationMode: "other",
        },
        CONTEXT,
      ),
    { code: "INVALID_IDENTITY_DATA" },
  );

  assert.throws(
    () =>
      crypto.encryptIdentityPayload(
        "aadhaar",
        {
          ...IDTO_AADHAAR_PAYLOAD,
          dateOfBirth: "1990-02-30",
        },
        CONTEXT,
      ),
    { code: "INVALID_IDENTITY_DATA" },
  );
});
