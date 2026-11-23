import assert from "node:assert/strict";
import { test } from "node:test";

import adminDashboardModel from "./adminDashboard.model.js";
import {
  getDashboardSummary,
  getIndiaBusinessPeriods,
} from "./adminDashboard.service.js";

test("admin dashboard periods use Asia/Kolkata midnight boundaries", () => {
  const periods = getIndiaBusinessPeriods(new Date("2026-11-23T18:29:59.999Z"));

  assert.equal(periods.todayStart.toISOString(), "2026-11-22T18:30:00.000Z");
  assert.equal(periods.tomorrowStart.toISOString(), "2026-11-23T18:30:00.000Z");
  assert.equal(periods.monthStart.toISOString(), "2026-10-31T18:30:00.000Z");
  assert.equal(periods.nextMonthStart.toISOString(), "2026-11-30T18:30:00.000Z");
});

test("admin dashboard periods roll into the next India day at midnight", () => {
  const periods = getIndiaBusinessPeriods(new Date("2026-11-23T18:30:00.000Z"));

  assert.equal(periods.todayStart.toISOString(), "2026-11-23T18:30:00.000Z");
  assert.equal(periods.tomorrowStart.toISOString(), "2026-11-24T18:30:00.000Z");
});

test("admin dashboard periods handle the December to January month boundary", () => {
  const periods = getIndiaBusinessPeriods(new Date("2026-12-31T18:30:00.000Z"));

  assert.equal(periods.monthStart.toISOString(), "2026-12-31T18:30:00.000Z");
  assert.equal(periods.nextMonthStart.toISOString(), "2027-01-31T18:30:00.000Z");
});

test("admin dashboard summary maps aggregate counts without classifying blocked users as inactive", async (t) => {
  const original = adminDashboardModel.getDashboardSummaryCounts;
  let capturedPeriods;

  adminDashboardModel.getDashboardSummaryCounts = async (periods) => {
    capturedPeriods = periods;
    return {
      total_users: "10",
      active_accounts: "6",
      inactive_accounts: "2",
      pending_kyc_applications: "3",
      kyc_approved_today: "1",
      registrations_today: "4",
      registrations_this_month: "7",
    };
  };

  t.after(() => {
    adminDashboardModel.getDashboardSummaryCounts = original;
  });

  const now = new Date("2026-11-23T12:00:00.000Z");
  const result = await getDashboardSummary({ now });

  assert.deepEqual(result.users, {
    total: 10,
    active: 6,
    inactive: 2,
  });
  assert.deepEqual(result.kyc, {
    pendingReview: 3,
    approvedToday: 1,
  });
  assert.deepEqual(result.registrations, {
    today: 4,
    thisMonth: 7,
  });
  assert.equal(result.period.timeZone, "Asia/Kolkata");
  assert.equal(result.generatedAt, now.toISOString());
  assert.equal(capturedPeriods.todayStart.toISOString(), "2026-11-22T18:30:00.000Z");
});

test("admin dashboard summary rejects an invalid clock value", async () => {
  await assert.rejects(
    getDashboardSummary({ now: new Date("invalid") }),
    /A valid date is required/,
  );
});
