import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePanXml } from "./pan.validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "..", "digilocker", "fixtures");

const TEST_ENV = {
  NODE_ENV: "development",
  IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
  IDTO_PROVIDER_MODE: "idto",
  IDTO_DEV_UNVERIFIED_DATABASE: "true",
  DB_HOST: "127.0.0.1",
  DB_NAME: "fintech_kyc",
};

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("validatePanXml returns masked identifier and verified name from valid mock fixture", () => {
  const xml = readFixture("pan.xml");

  const result = validatePanXml(xml, {
    env: TEST_ENV,
  });

  assert.equal(result.signatureVerified, false);
  assert.equal(result.developmentOnly, true);
  assert.equal(result.verificationMode, "development_unverified");
  assert.ok(result.panNumber);
  assert.ok(/^[A-Z]{5}\d{4}[A-Z]$/.test(result.panNumber));
  assert.equal(result.maskedIdentifier, `XXXXXX${result.panNumber.slice(-4)}`);
  assert.ok(result.verifiedName);
});

test("validatePanXml rejects tampered XML", () => {
  const xml = readFixture("pan.xml").replace("PANCR", "WRONG");

  assert.throws(
    () => validatePanXml(xml, { env: TEST_ENV }),
    { code: "INVALID_PAN_DOCUMENT" }
  );
});

test("validatePanXml rejects empty input", () => {
  assert.throws(
    () => validatePanXml("", { env: TEST_ENV }),
    { code: "INVALID_PAN_DOCUMENT" }
  );
});