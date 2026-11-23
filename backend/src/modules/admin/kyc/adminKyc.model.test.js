
  import assert from "node:assert/strict";
  import { test } from "node:test";

  import pool from "../../../config/db.js";
import {
  findKycApplications,
  countKycApplications,
  findRecentKycApplications,
  countRecentKycApplications,
  rejectKycCase,
} from "./adminKyc.model.js";

  test("adminKyc.model: fetches applications with status and pagination filters", async () => {
    const originalExecute = pool.execute;

    try {
      let capturedSql = "";
      let capturedParams = [];

      pool.execute = async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;

        return [
          [
            {
              case_id: 1,
              user_id: 10,
              name: "Test User",
              email: "test@example.com",
              kyc_status: "submitted",
            },
          ],
          [],
        ];
      };

      const result = await findKycApplications({
        statuses: ["submitted", "under_review"],
        limit: 10,
        offset: 20,
      });

      assert.match(capturedSql, /WHERE kc\.status IN \(\?, \?\)/);
      assert.match(capturedSql, /LIMIT \? OFFSET \?/);
      assert.deepEqual(capturedParams, [
        "submitted",
        "under_review",
        10,
        20,
      ]);

      assert.equal(result.length, 1);
      assert.equal(result[0].case_id, 1);

      // The list query must not select sensitive identity or bank details.
      assert.doesNotMatch(capturedSql, /aadhaar_number|pan_number|account_number/i);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test("adminKyc.model: counts applications for the requested statuses", async () => {
    const originalExecute = pool.execute;

    try {
      let capturedSql = "";
      let capturedParams = [];

      pool.execute = async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;

        return [[{ total: 25 }], []];
      };

      const result = await countKycApplications([
        "submitted",
        "under_review",
      ]);

      assert.match(capturedSql, /SELECT COUNT\(\*\) AS total/);
      assert.match(capturedSql, /WHERE status IN \(\?, \?\)/);
      assert.deepEqual(capturedParams, ["submitted", "under_review"]);
      assert.equal(result, 25);
    } finally {
      pool.execute = originalExecute;
    }
  });

  test("adminKyc.model: rejects an empty status array when fetching applications", async () => {
    await assert.rejects(
      findKycApplications({
        statuses: [],
        limit: 10,
        offset: 0,
      }),
      /At least one KYC status is required/,
    );
  });

  test("adminKyc.model: rejects an empty status array when counting applications", async () => {
    await assert.rejects(
      countKycApplications([]),
      /At least one KYC status is required/,
    );
  });

test("adminKyc.model: recent applications use safe parameterized filters and submission ordering", async (t) => {
  const originalExecute = pool.execute;
  const calls = [];

  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    if (/SELECT COUNT\(\*\) AS total/.test(sql)) return [[{ total: 14 }]];
    return [[{ case_id: 14, user_id: 8, name: "Asha Sharma" }]];
  };

  t.after(() => {
    pool.execute = originalExecute;
  });

  const submittedFrom = new Date("2026-11-01T00:00:00.000Z");
  const submittedTo = new Date("2026-12-01T00:00:00.000Z");
  const filters = {
    statuses: ["submitted", "under_review"],
    numericSearch: 14,
    nameSearch: null,
    submittedFrom,
    submittedTo,
    limit: 25,
    offset: 50,
  };

  const applications = await findRecentKycApplications(filters);
  const total = await countRecentKycApplications(filters);

  assert.equal(applications.length, 1);
  assert.equal(total, 14);
  assert.match(calls[0].sql, /kc\.status IN \(\?, \?\)/);
  assert.match(calls[0].sql, /kc\.submitted_at IS NOT NULL/);
  assert.match(calls[0].sql, /\(kc\.id = \? OR kc\.user_id = \?\)/);
  assert.match(calls[0].sql, /kc\.submitted_at >= \?/);
  assert.match(calls[0].sql, /kc\.submitted_at < \?/);
  assert.match(calls[0].sql, /ORDER BY kc\.submitted_at DESC, kc\.id DESC/);
  assert.match(calls[0].sql, /LIMIT \? OFFSET \?/);
  assert.doesNotMatch(calls[0].sql, /identity_data|account_number|storage_key|provider_reference/i);
  assert.deepEqual(calls[0].params, ["submitted", "under_review", 14, 14, submittedFrom, submittedTo, 25, 50]);
  assert.deepEqual(calls[1].params, ["submitted", "under_review", 14, 14, submittedFrom, submittedTo]);
});

test("adminKyc.model: recent applications parameterize name search", async (t) => {
  const originalExecute = pool.execute;
  let capturedSql = "";
  let capturedParams = [];
  pool.execute = async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return [[]];
  };
  t.after(() => {
    pool.execute = originalExecute;
  });

  await findRecentKycApplications({
    statuses: ["approved"],
    numericSearch: null,
    nameSearch: "Asha",
    submittedFrom: null,
    submittedTo: null,
    limit: 25,
    offset: 0,
  });

  assert.match(capturedSql, /u\.name LIKE \?/);
  assert.deepEqual(capturedParams, ["approved", "%Asha%", 25, 0]);
});

test("adminKyc.model: approved review-date filters require review timestamps and order by approval date", async (t) => {
  const originalExecute = pool.execute;
  const calls = [];
  pool.execute = async (sql, params) => {
    calls.push({ sql, params });
    return [[{ total: 1 }]];
  };
  t.after(() => {
    pool.execute = originalExecute;
  });

  const reviewedFrom = new Date("2026-11-22T18:30:00.000Z");
  const reviewedTo = new Date("2026-11-23T18:30:00.000Z");
  const filters = {
    statuses: ["approved"],
    numericSearch: null,
    nameSearch: null,
    submittedFrom: null,
    submittedTo: null,
    reviewedFrom,
    reviewedTo,
    limit: 25,
    offset: 0,
  };

  await findRecentKycApplications(filters);
  await countRecentKycApplications(filters);

  assert.match(calls[0].sql, /kc\.reviewed_at IS NOT NULL/);
  assert.match(calls[0].sql, /kc\.reviewed_at >= \?/);
  assert.match(calls[0].sql, /kc\.reviewed_at < \?/);
  assert.match(calls[0].sql, /ORDER BY kc\.reviewed_at DESC, kc\.id DESC/);
  assert.deepEqual(calls[0].params, ["approved", reviewedFrom, reviewedTo, 25, 0]);
  assert.deepEqual(calls[1].params, ["approved", reviewedFrom, reviewedTo]);
});

//
// ADMIN KYC REJECTION MODEL TESTS
//

test(
  "adminKyc.model: rejects a case using parameterized SQL",
  async () => {
    let capturedSql = "";
    let capturedParams = [];

    const connection = {
      execute: async (sql, params) => {
        capturedSql = sql;
        capturedParams = params;

        return [{ affectedRows: 1 }];
      },
    };

    const result = await rejectKycCase(
      connection,
      14,
      "Video KYC recording is unclear",
    );

    assert.equal(result, true);

    assert.match(
      capturedSql,
      /UPDATE kyc_cases/,
    );

    assert.match(
      capturedSql,
      /status = 'rejected'/,
    );

    assert.match(
      capturedSql,
      /rejection_reason = \?/,
    );

    assert.match(
      capturedSql,
      /status IN \('submitted', 'under_review'\)/,
    );

    assert.deepEqual(capturedParams, [
      "Video KYC recording is unclear",
      14,
    ]);
  },
);

test(
  "adminKyc.model: reports failure when no KYC row was updated",
  async () => {
    const connection = {
      execute: async () => [
        { affectedRows: 0 },
      ],
    };

    const result = await rejectKycCase(
      connection,
      14,
      "Invalid KYC media",
    );

    assert.equal(result, false);
  },
);
