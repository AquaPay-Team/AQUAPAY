import assert from "node:assert/strict";
import { test } from "node:test";

import "../../auth/setupEnv.js";

import statusModel from "./status.model.js";
import statusService from "./status.service.js";
import { StatusCache } from "./statusCache.js";

// ── helpers ──

function mockCase(overrides = {}) {
  return {
    id: 101,
    user_id: 42,
    status: "draft",
    current_step: 1,
    submitted_at: null,
    reviewed_at: null,
    created_at: new Date("2026-01-01T00:00:00Z"),
    updated_at: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function mockSteps() {
  return [
    {
      step_number: 1,
      status: "completed",
      completed_at: new Date("2026-01-01T01:00:00Z"),
    },
    { step_number: 2, status: "in_progress", completed_at: null },
    { step_number: 3, status: "pending", completed_at: null },
  ];
}

// ── service tests ──

test("KYC status returns hasCase false when user has no case", async () => {
  const originalFind = statusModel.findCaseByUserId;
  statusModel.findCaseByUserId = async () => null;
  statusService._cache.clear();
  try {
    const result = await statusService.getStatus("42");
    assert.equal(result.hasCase, false);
    assert.equal(result.case, null);
  } finally {
    statusModel.findCaseByUserId = originalFind;
    statusService._cache.clear();
  }
});

test("KYC status returns case with steps when user has a case", async () => {
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async (userId) => {
    assert.equal(userId, "42");
    return mockCase();
  };
  statusModel.findStepsByCaseId = async (caseId) => {
    assert.equal(caseId, 101);
    return mockSteps();
  };
  statusService._cache.clear();

  try {
    const result = await statusService.getStatus("42");
    assert.equal(result.hasCase, true);
    assert.equal(result.case.status, "draft");
    assert.equal(result.case.currentStep, 1);
    assert.equal(result.case.steps.length, 3);
    assert.equal(result.case.steps[0].stepNumber, 1);
    assert.equal(result.case.steps[0].status, "completed");
    assert.notEqual(result.case.steps[0].completedAt, null);
    assert.equal(result.case.steps[1].stepNumber, 2);
    assert.equal(result.case.steps[1].status, "in_progress");
    assert.equal(result.case.steps[1].completedAt, null);
    assert.equal(result.case.steps[2].stepNumber, 3);
    assert.equal(result.case.steps[2].status, "pending");
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC status does not expose internal IDs or rejection details", async () => {
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () =>
    mockCase({ rejection_reason: "Documents blurry" });
  statusModel.findStepsByCaseId = async () =>
    mockSteps().map((s) => ({ ...s, failure_code: "DOC_BLURRY" }));
  statusService._cache.clear();

  try {
    const result = await statusService.getStatus("42");
    assert.equal(result.case.id, undefined);
    assert.equal(result.case.user_id, undefined);
    assert.equal(result.case.rejection_reason, undefined);
    for (const step of result.case.steps) {
      assert.equal(step.id, undefined);
      assert.equal(step.case_id, undefined);
      assert.equal(step.failure_code, undefined);
    }
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC status returns 503 when database fails on case lookup", async () => {
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => {
    throw new Error("connection timeout");
  };
  statusService._cache.clear();

  try {
    await assert.rejects(
      () => statusService.getStatus("42"),
      (error) =>
        error.statusCode === 503 &&
        error.code === "SERVICE_UNAVAILABLE" &&
        !error.message.includes("connection timeout"),
    );
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC status returns 503 when database fails on step lookup", async () => {
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => mockCase();
  statusModel.findStepsByCaseId = async () => {
    throw new Error("connection timeout");
  };
  statusService._cache.clear();

  try {
    await assert.rejects(
      () => statusService.getStatus("42"),
      (error) =>
        error.statusCode === 503 &&
        error.code === "SERVICE_UNAVAILABLE" &&
        !error.message.includes("connection timeout"),
    );
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC status returns empty steps array when case has no steps", async () => {
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => mockCase();
  statusModel.findStepsByCaseId = async () => [];
  statusService._cache.clear();

  try {
    const result = await statusService.getStatus("42");
    assert.equal(result.hasCase, true);
    assert.deepEqual(result.case.steps, []);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC model uses parameterized queries", async () => {
  const pool = (await import("../../../config/db.js")).default;
  const originalExecute = pool.execute;
  const captured = [];

  pool.execute = async (sql, params) => {
    captured.push({ sql, params });
    return [[]];
  };

  try {
    await statusModel.findCaseByUserId(42);
    assert.equal(captured.length, 1);
    assert.match(captured[0].sql, /WHERE user_id = \?/);
    assert.deepEqual(captured[0].params, [42]);

    await statusModel.findStepsByCaseId(101);
    assert.equal(captured.length, 2);
    assert.match(captured[1].sql, /WHERE case_id = \?/);
    assert.deepEqual(captured[1].params, [101]);
    assert.match(captured[1].sql, /ORDER BY step_number ASC/);
  } finally {
    pool.execute = originalExecute;
  }
});

// ── statusCache unit tests ──

test("StatusCache: get returns undefined for missing and expired entries", async () => {
  const cache = new StatusCache({ ttlMs: 50 });

  assert.equal(cache.get("missing"), undefined);

  cache.set("key1", { data: "hello" });
  assert.deepEqual(cache.get("key1"), { data: "hello" });

  await new Promise((resolve) => setTimeout(resolve, 60));
  assert.equal(cache.get("key1"), undefined);
});

test("StatusCache: evicts oldest entry when maxSize is reached", () => {
  const cache = new StatusCache({ ttlMs: 60_000, maxSize: 3 });

  cache.set("a", 1);
  cache.set("b", 2);
  cache.set("c", 3);
  assert.equal(cache.size, 3);

  cache.set("d", 4);
  assert.equal(cache.size, 3);
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), 2);
  assert.equal(cache.get("c"), 3);
  assert.equal(cache.get("d"), 4);
});

test("StatusCache: invalidate removes a single key", () => {
  const cache = new StatusCache({ ttlMs: 60_000 });

  cache.set("user1", "val1");
  cache.set("user2", "val2");

  cache.invalidate("user1");

  assert.equal(cache.get("user1"), undefined);
  assert.equal(cache.get("user2"), "val2");
});

// ── cache integration tests with getStatus ──

test("KYC cache: first call queries DB, second within TTL uses cache", async () => {
  let dbCallCount = 0;
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => {
    dbCallCount++;
    return mockCase();
  };
  statusModel.findStepsByCaseId = async () => mockSteps();
  statusService._cache.clear();

  try {
    const res1 = await statusService.getStatus("42");
    assert.equal(dbCallCount, 1);
    assert.equal(res1.hasCase, true);

    const res2 = await statusService.getStatus("42");
    assert.equal(dbCallCount, 1);
    assert.deepEqual(res1, res2);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC cache: different users do not share cached data", async () => {
  let queriedUserIds = [];
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async (userId) => {
    queriedUserIds.push(userId);
    return mockCase({ user_id: Number(userId) });
  };
  statusModel.findStepsByCaseId = async () => mockSteps();
  statusService._cache.clear();

  try {
    await statusService.getStatus("1");
    await statusService.getStatus("2");

    assert.equal(queriedUserIds.length, 2);
    assert.deepEqual(queriedUserIds, ["1", "2"]);

    await statusService.getStatus("1");
    assert.equal(queriedUserIds.length, 2);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC cache: expired entry triggers a fresh database read", async () => {
  let dbCallCount = 0;
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => {
    dbCallCount++;
    return mockCase();
  };
  statusModel.findStepsByCaseId = async () => mockSteps();

  const shortLivedCache = new StatusCache({ ttlMs: 50 });
  const originalCache = statusService._cache;
  statusService._cache = shortLivedCache;

  try {
    await statusService.getStatus("99");
    assert.equal(dbCallCount, 1);

    await statusService.getStatus("99");
    assert.equal(dbCallCount, 1);

    await new Promise((resolve) => setTimeout(resolve, 60));

    await statusService.getStatus("99");
    assert.equal(dbCallCount, 2);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache = originalCache;
  }
});

test("KYC cache: database errors are not cached", async () => {
  let shouldFail = true;
  let dbCallCount = 0;
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => {
    dbCallCount++;
    if (shouldFail) {
      throw new Error("temporary outage");
    }
    return mockCase();
  };
  statusModel.findStepsByCaseId = async () => mockSteps();
  statusService._cache.clear();

  try {
    await assert.rejects(() => statusService.getStatus("77"));
    assert.equal(dbCallCount, 1);
    assert.equal(statusService._cache.get("77"), undefined);

    shouldFail = false;
    const res = await statusService.getStatus("77");
    assert.equal(dbCallCount, 2);
    assert.equal(res.hasCase, true);

    const cachedRes = await statusService.getStatus("77");
    assert.equal(dbCallCount, 2);
    assert.deepEqual(res, cachedRes);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});

test("KYC cache: no-case response is cached", async () => {
  let dbCallCount = 0;
  const originalFindCase = statusModel.findCaseByUserId;

  statusModel.findCaseByUserId = async () => {
    dbCallCount++;
    return null;
  };
  statusService._cache.clear();

  try {
    const res1 = await statusService.getStatus("55");
    assert.equal(dbCallCount, 1);
    assert.equal(res1.hasCase, false);

    const res2 = await statusService.getStatus("55");
    assert.equal(dbCallCount, 1);
    assert.deepEqual(res1, res2);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusService._cache.clear();
  }
});

test("KYC cache: invalidateStatus forces next call to query DB", async () => {
  let dbCallCount = 0;
  const originalFindCase = statusModel.findCaseByUserId;
  const originalFindSteps = statusModel.findStepsByCaseId;

  statusModel.findCaseByUserId = async () => {
    dbCallCount++;
    return mockCase();
  };
  statusModel.findStepsByCaseId = async () => mockSteps();
  statusService._cache.clear();

  try {
    await statusService.getStatus("66");
    assert.equal(dbCallCount, 1);

    await statusService.getStatus("66");
    assert.equal(dbCallCount, 1);

    statusService.invalidateStatus("66");

    await statusService.getStatus("66");
    assert.equal(dbCallCount, 2);
  } finally {
    statusModel.findCaseByUserId = originalFindCase;
    statusModel.findStepsByCaseId = originalFindSteps;
    statusService._cache.clear();
  }
});
