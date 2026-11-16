import assert from "node:assert/strict";
import { test } from "node:test";
import logger from "./logger.js";
import { requestContextMiddleware } from "../middlewares/requestContext.middleware.js";

test("structured logs include request ID and redact secret/identity fields", () => {
  const originalInfo = console.info;
  const output = [];
  console.info = (line) => output.push(JSON.parse(line));
  try {
    requestContextMiddleware({
      method: "GET",
      path: "/test",
    }, {
      setHeader(name, value) { this[name] = value; },
    }, () => logger.info("test.safe_event", {
      statusCode: 200,
      apiKey: "secret-key",
      authorizationCode: "authorization-code",
      aadhaarNumber: "1234",
      fullPan: "ABCDE1234F",
      account_holder_name: "Synthetic Person",
    }));
    assert.equal(output.length, 1);
    assert.match(output[0].requestId, /^[0-9a-f-]{36}$/i);
    assert.equal(output[0].statusCode, 200);
    assert.equal(JSON.stringify(output[0]).includes("secret-key"), false);
    assert.equal(JSON.stringify(output[0]).includes("authorization-code"), false);
    assert.equal(JSON.stringify(output[0]).includes("1234"), false);
    assert.equal(JSON.stringify(output[0]).includes("ABCDE1234F"), false);
    assert.equal(JSON.stringify(output[0]).includes("Synthetic Person"), false);
  } finally {
    console.info = originalInfo;
  }
});

test("structured log values are bounded and control characters are removed", () => {
  const originalWarn = console.warn;
  let logged;
  console.warn = (line) => { logged = JSON.parse(line); };
  try {
    logger.warn("test.bounded", { stage: `${"a".repeat(200)}\nunsafe` });
    assert.equal(logged.stage.length, 160);
    assert.equal(logged.stage.includes("\n"), false);
  } finally {
    console.warn = originalWarn;
  }
});
