import assert from "node:assert/strict";
import { test } from "node:test";
import { createReadinessHandler } from "./health.controller.js";

function responseRecorder() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test("readiness returns ready only when MySQL and Redis both respond", async () => {
  const handler = createReadinessHandler({
    checkDatabase: async () => {},
    checkRedis: async () => {},
  });
  const response = responseRecorder();
  await handler({}, response);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    success: true,
    status: "ready",
    dependencies: { mysql: "ready", redis: "ready" },
  });
});

test("readiness safely reports dependency failure without internal details", async () => {
  const handler = createReadinessHandler({
    checkDatabase: async () => { throw new Error("sensitive connection data"); },
    checkRedis: async () => {},
  });
  const response = responseRecorder();
  await handler({}, response);
  assert.equal(response.statusCode, 503);
  assert.deepEqual(response.body, {
    success: false,
    status: "not_ready",
    dependencies: { mysql: "unavailable", redis: "ready" },
  });
  assert.equal(JSON.stringify(response.body).includes("sensitive"), false);
});
