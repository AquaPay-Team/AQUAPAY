import assert from "node:assert/strict";
import { test } from "node:test";

import pool from "../../../config/db.js";
import { getDashboardSummaryCounts } from "./adminDashboard.model.js";

test("admin dashboard model uses parameterized, indexed time ranges and authoritative KYC states", async (t) => {
  const originalExecute = pool.execute;
  let capturedSql = "";
  let capturedParams = [];

  pool.execute = async (sql, params) => {
    capturedSql = sql;
    capturedParams = params;
    return [[{
      total_users: 10,
      active_accounts: 6,
      inactive_accounts: 2,
      pending_kyc_applications: 3,
      kyc_approved_today: 1,
      registrations_today: 4,
      registrations_this_month: 7,
    }]];
  };

  t.after(() => {
    pool.execute = originalExecute;
  });

  const periods = {
    todayStart: new Date("2026-11-22T18:30:00.000Z"),
    tomorrowStart: new Date("2026-11-23T18:30:00.000Z"),
    monthStart: new Date("2026-10-31T18:30:00.000Z"),
    nextMonthStart: new Date("2026-11-30T18:30:00.000Z"),
  };

  const result = await getDashboardSummaryCounts(periods);

  assert.equal(result.total_users, 10);
  assert.match(capturedSql, /status = 'active'/);
  assert.match(capturedSql, /status = 'inactive'/);
  assert.match(capturedSql, /status IN \('submitted', 'under_review'\)/);
  assert.match(capturedSql, /status = 'approved'[\s\S]*reviewed_at >= \?[\s\S]*reviewed_at < \?/);
  assert.match(capturedSql, /created_at >= \?[\s\S]*created_at < \?/);
  assert.doesNotMatch(capturedSql, /DATE\s*\(|CONVERT_TZ\s*\(/i);
  assert.doesNotMatch(capturedSql, /verified_at/i);
  assert.deepEqual(capturedParams, [
    periods.todayStart,
    periods.tomorrowStart,
    periods.todayStart,
    periods.tomorrowStart,
    periods.monthStart,
    periods.nextMonthStart,
  ]);
});
