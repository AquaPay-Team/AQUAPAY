import test from "node:test";
import assert from "node:assert/strict";
import app from "../../../../../app.js";
import panController from "../pan.controller.js";
import panService from "../pan.service.js";

import {
  createPanDocumentProvider,
  createRealPanDocumentProvider,
  PAN_ENDPOINTS,
} from "../pan.provider.js";

const env = {
  NODE_ENV: "test",
  IDTO_PROVIDER_MODE: "idto",
  IDTO_BASE_URL: "https://prod.idto.ai",
  IDTO_CLIENT_ID: "synthetic-client",
  IDTO_API_KEY: "synthetic-key",
};

test("PAN Detailed provider sends the documented POST request and authenticated headers", async () => {
  const calls = [];
  const provider = createRealPanDocumentProvider({
    env,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({
        status: "success",
        error_code: null,
        data: { pan_number: "ABCDE1234F", full_name: "Rahul Kumar Sharma" },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const body = { pan_number: "ABCDE1234F", user_consent: true, name: "Rahul Kumar Sharma" };
  const response = await provider.verifyPanDetailed(body);

  assert.equal(response.data.pan_number, body.pan_number);
  assert.equal(calls[0].url, `https://prod.idto.ai${PAN_ENDPOINTS.panDetailed}`);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers["X-Client-ID"], env.IDTO_CLIENT_ID);
  assert.equal(calls[0].options.headers["X-API-KEY"], env.IDTO_API_KEY);
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(calls[0].options.body), body);
  assert.equal(Object.hasOwn(calls[0].options.headers, "Idempotency-Key"), false);
});

test("PAN provider preserves only allowlisted provider error metadata", async () => {
  const provider = createRealPanDocumentProvider({
    env,
    fetchImpl: async () => new Response(JSON.stringify({ error_code: "IDTO_006", message: "limited" }), {
      status: 429,
      headers: { "content-type": "application/json" },
    }),
  });
  await assert.rejects(provider.verifyPanDetailed({}), (error) => {
    assert.equal(error.statusCode, 429);
    assert.equal(error.responseMetadata.providerErrorCode, "IDTO_006");
    assert.equal(JSON.stringify(error.responseMetadata).includes("limited"), false);
    return true;
  });
});

test("PAN provider sanitizes timeout, invalid JSON and provider HTTP errors", async (t) => {
  await t.test("timeout", async () => {
    const provider = createRealPanDocumentProvider({
      env,
      fetchImpl: async () => { const error = new Error("timeout"); error.name = "AbortError"; throw error; },
    });
    await assert.rejects(provider.verifyPanDetailed({}), { code: "IDTO_TIMEOUT" });
  });
  await t.test("invalid JSON", async () => {
    const provider = createRealPanDocumentProvider({
      env,
      fetchImpl: async () => new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    });
    await assert.rejects(provider.verifyPanDetailed({}), { code: "IDTO_INVALID_RESPONSE" });
  });
  await t.test("HTTP failure", async () => {
    const provider = createRealPanDocumentProvider({
      env,
      fetchImpl: async () => new Response("{}", { status: 503, headers: { "content-type": "application/json" } }),
    });
    await assert.rejects(provider.verifyPanDetailed({}), (error) => error.statusCode === 503);
  });
});

test("PAN-specific mock provider is local-only and returns a non-production marker", async () => {
  const provider = createPanDocumentProvider({ env: { NODE_ENV: "development", IDTO_PROVIDER_MODE: "mock" } });
  assert.equal(provider.mode, "mock");
  assert.equal(provider.providerName, "idto_pan_detailed_v2_mock");
  const result = await provider.verifyPanDetailed({
    pan_number: "ABCDE1234F", user_consent: true, name: "Synthetic Test User",
  });
  assert.equal(result.data.pan_number, "ABCDE1234F");
  assert.equal(result.data.full_name, "Synthetic Test User");
  assert.throws(
    () => createPanDocumentProvider({ env: { NODE_ENV: "production", IDTO_PROVIDER_MODE: "mock" } }),
    { code: "IDTO_MOCK_MODE_FORBIDDEN" },
  );
});

test("mounted PAN verification endpoint rejects an unauthenticated request", async () => {
  const server = app.listen(0);
  try {
    await new Promise((resolve) => server.once("listening", resolve));
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/kyc/pan/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ panNumber: "ABCDE1234F", consent: true }),
    });
    const body = await response.json();
    assert.equal(response.status, 401);
    assert.equal(body.code, "UNAUTHORIZED");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("PAN controller labels a mock result as unverified in the API response", async () => {
  const originalVerifyPan = panService.verifyPan;
  let response;
  let statusCode;
  panService.verifyPan = async (userId, request) => {
    assert.equal(userId, "42");
    assert.deepEqual(request, { panNumber: "ABCDE1234F", consent: true });
    return {
      status: "development_unverified",
      developmentOnly: true,
      maskedIdentifier: "XXXXXX234F",
      stepNumber: 3,
      steps_completed: 3,
    };
  };
  try {
    await new Promise((resolve, reject) => {
      const res = {
        status(code) { statusCode = code; return this; },
        json(body) { response = body; resolve(); return this; },
      };
      panController.verifyPan({
        user: { id: "42" },
        validatedPanRequest: { panNumber: "ABCDE1234F", consent: true },
      }, res, reject);
    });
  } finally {
    panService.verifyPan = originalVerifyPan;
  }
  assert.equal(statusCode, 200);
  assert.equal(response.data.status, "development_unverified");
  assert.equal(response.message, "Development mock PAN flow completed; this result is unverified");
});
