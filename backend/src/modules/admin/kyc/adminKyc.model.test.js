
  import assert from "node:assert/strict";
  import { test } from "node:test";

  import pool from "../../../config/db.js";
import {
  findKycApplications,
  countKycApplications,
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
