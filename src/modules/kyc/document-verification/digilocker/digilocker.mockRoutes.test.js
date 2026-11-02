import "../../../auth/setupEnv.js";
import assert from "node:assert/strict";
import express from "express";
import { test } from "node:test";

process.env.NODE_ENV = "test";
process.env.IDTO_PROVIDER_MODE = "mock";
process.env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION = "false";
process.env.IDTO_MOCK_BASE_URL = "http://127.0.0.1:3000";

const { default: kycRoutes } = await import("../../kyc.routes.js");

test("mock authorization route exists only in the explicit local mock app and returns the callback contract", async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/kyc", kycRoutes);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    const state = "s".repeat(43);
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/kyc/digilocker/mock-authorize?state=${state}&document=PANCR`,
      { redirect: "manual" },
    );
    assert.equal(response.status, 303);
    const location = new URL(response.headers.get("location"), `http://127.0.0.1:${address.port}`);
    assert.equal(location.pathname, "/api/kyc/digilocker/callback");
    assert.deepEqual([...location.searchParams.keys()].sort(), ["clientId", "code", "codeVerifier", "state"]);
    assert.equal(location.searchParams.get("code"), "aquapay-mock-pancr-v1");
    assert.equal(location.searchParams.get("codeVerifier"), "m".repeat(43));
    assert.equal(location.searchParams.get("clientId"), "aquapay-local-mock-client");
    assert.equal(location.searchParams.get("state"), state);

    const protectedPanInitiation = await fetch(
      `http://127.0.0.1:${address.port}/api/kyc/digilocker/pan/initiate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }) },
    );
    assert.equal(protectedPanInitiation.status, 401);

    const protectedAadhaarInitiation = await fetch(
      `http://127.0.0.1:${address.port}/api/kyc/digilocker/aadhaar/initiate`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent: true }) },
    );
    assert.equal(protectedAadhaarInitiation.status, 401);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
