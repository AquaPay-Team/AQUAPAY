import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";

import pool from "../../../config/db.js";
import redisConnection from "../../../config/redis.js";
import app from "../../../app.js";
import authModel from "../../auth/auth.model.js";
import { getAuthConfig, JWT_AUDIENCE, JWT_ISSUER } from "../../../config/auth.js";
import adminOperationsService from "./adminOperations.service.js";
import {
  getMonitoringSnapshot,
  recordApplicationError,
  requestMonitoringMiddleware,
  resetOperationsMonitorForTests,
} from "../../../monitoring/operationsMonitor.js";

test("operations monitor records process-local request metrics and safe error events", () => {
  resetOperationsMonitorForTests();
  let finished;
  requestMonitoringMiddleware(
    { method: "GET", baseUrl: "/api", path: "/test" },
    { statusCode: 503, on: (event, callback) => { if (event === "finish") finished = callback; } },
    () => {},
  );
  finished();
  recordApplicationError({ method: "GET", baseUrl: "/api", path: "/test" }, 503);

  const snapshot = getMonitoringSnapshot();
  assert.equal(snapshot.server.liveness, "alive");
  assert.equal(snapshot.api.scope, "current_process_since_start");
  assert.equal(snapshot.api.requestCount, 1);
  assert.equal(snapshot.api.errorCount, 1);
  assert.equal(snapshot.api.errorRatePercent, 100);
  assert.equal(snapshot.logs.entries[0].path, "/api/test");
  assert.equal(snapshot.logs.entries[0].statusCode, 503);
});

test("operations overview reports live dependency readiness without connection details", async (t) => {
  const originalQuery = pool.query;
  const originalGetRedisClient = redisConnection.getRedisClient;
  pool.query = async () => [[{ ok: 1 }]];
  redisConnection.getRedisClient = async () => ({ ping: async () => "PONG" });
  t.after(() => {
    pool.query = originalQuery;
    redisConnection.getRedisClient = originalGetRedisClient;
  });

  const overview = await adminOperationsService.getOperationsOverview();
  assert.equal(overview.dependencies.mysql.status, "ready");
  assert.equal(overview.dependencies.redis.status, "ready");
  assert.equal(overview.reports.historical.available, true);
  assert.equal(overview.reports.operational.available, true);
  assert.equal(overview.reports.operational.scope, "persisted_mysql");
  assert.ok(overview.reports.operational.last24Hours);
  assert.ok(overview.reports.operational.last7Days);
  assert.ok(Array.isArray(overview.reports.operational.hourlyBreakdown));
  assert.ok(overview.reports.platformActivity);
  assert.doesNotMatch(JSON.stringify(overview), /password|redis:\/\/|mysql:\/\//i);
});

test("operations overview treats failed dependencies as unavailable", async (t) => {
  const originalQuery = pool.query;
  const originalGetRedisClient = redisConnection.getRedisClient;
  pool.query = async () => { throw new Error("database unavailable"); };
  redisConnection.getRedisClient = async () => { throw new Error("redis unavailable"); };
  t.after(() => {
    pool.query = originalQuery;
    redisConnection.getRedisClient = originalGetRedisClient;
  });

  const overview = await adminOperationsService.getOperationsOverview();
  assert.equal(overview.dependencies.mysql.status, "unavailable");
  assert.equal(overview.dependencies.redis.status, "unavailable");
});

test("operations overview requires authenticated Admin access", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  t.after(() => server.close());
  await new Promise((resolve) => server.once("listening", resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  const unauthenticated = await fetch(`${baseUrl}/api/admin/operations/overview`);
  assert.equal(unauthenticated.status, 401);

  const originalIsUserActive = authModel.isUserActive;
  const originalIsAdmin = authModel.isAdmin;
  authModel.isUserActive = async () => true;
  authModel.isAdmin = async () => false;
  t.after(() => {
    authModel.isUserActive = originalIsUserActive;
    authModel.isAdmin = originalIsAdmin;
  });
  const token = jwt.sign({ sub: "2" }, getAuthConfig().secret, {
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
    expiresIn: "5m",
  });
  const nonAdmin = await fetch(`${baseUrl}/api/admin/operations/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(nonAdmin.status, 403);
});
