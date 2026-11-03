import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePanXml } from "../pan.validator.js";
import { createRealPanDocumentProvider, PAN_ENDPOINTS } from "../pan.provider.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE_DIR = path.join(__dirname, "..", "..", "digilocker", "fixtures");

function readFixture(name) {
  return fs.readFileSync(path.join(FIXTURE_DIR, name), "utf8");
}

test("validatePanXml returns masked identifier and verified name from valid mock fixture", () => {
  const xml = readFixture("pan.xml");

  const result = validatePanXml(xml, {
    env: {
      NODE_ENV: "development",
      IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "true",
      IDTO_PROVIDER_MODE: "idto",
      IDTO_DEV_UNVERIFIED_DATABASE: "true",
      DB_HOST: "127.0.0.1",
      DB_NAME: "fintech_kyc",
    },
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

  assert.throws(() => validatePanXml(xml), {
    code: "INVALID_PAN_DOCUMENT",
  });
});

test("validatePanXml rejects empty input", () => {
  assert.throws(() => validatePanXml(""), {
    code: "INVALID_PAN_DOCUMENT",
  });
});

test("PAN document retrieval remains on its existing endpoints and shared authenticated HTTP transport", async () => {
  const calls = [];
  const env = {
    NODE_ENV: "test",
    IDTO_PROVIDER_MODE: "idto",
    IDTO_SKIP_XML_SIGNATURE_VERIFICATION: "false",
    IDTO_BASE_URL: "https://prod.idto.ai",
    IDTO_CLIENT_ID: "synthetic-client",
    IDTO_API_KEY: "synthetic-key",
  };
  const provider = createRealPanDocumentProvider({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return calls.length === 1
        ? new Response(JSON.stringify({ status: "success", issued_docs: { items: [] } }), {
          status: 200, headers: { "content-type": "application/json" },
        })
        : new Response("<Certificate/>", {
          status: 200, headers: { "content-type": "application/xml" },
        });
    },
  });
  const body = { reference_key: "synthetic-reference" };
  await provider.getIssuedDocs(body);
  await provider.getIssuedDocsXml({ ...body, uri: "synthetic-document-uri" });
  assert.deepEqual(calls.map(({ url }) => url), [
    `https://prod.idto.ai${PAN_ENDPOINTS.issuedDocs}`,
    `https://prod.idto.ai${PAN_ENDPOINTS.getIssuedDocsXml}`,
  ]);
  assert.equal(calls.every(({ options }) => options.method === "POST"), true);
  assert.equal(calls.every(({ options }) => options.headers["X-Client-ID"] === env.IDTO_CLIENT_ID), true);
  assert.equal(calls.every(({ options }) => options.headers["X-API-KEY"] === env.IDTO_API_KEY), true);
});
