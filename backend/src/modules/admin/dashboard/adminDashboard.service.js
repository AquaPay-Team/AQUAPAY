import adminDashboardModel from "./adminDashboard.model.js";

const INDIA_OFFSET_MINUTES = 5 * 60 + 30;
const INDIA_TIME_ZONE = "Asia/Kolkata";

function assertValidDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError("A valid date is required");
  }
}

/**
 * Returns UTC instants for the current India business day and month.
 * Asia/Kolkata has a fixed UTC+05:30 offset and does not observe DST.
 *
 * Database timestamp values are compared using these half-open UTC ranges.
 */
function getIndiaBusinessPeriods(now = new Date()) {
  assertValidDate(now);

  const shiftedNow = new Date(
    now.getTime() + INDIA_OFFSET_MINUTES * 60 * 1000,
  );
  const year = shiftedNow.getUTCFullYear();
  const month = shiftedNow.getUTCMonth();
  const day = shiftedNow.getUTCDate();

  const toIndiaMidnight = (targetYear, targetMonth, targetDay) =>
    new Date(
      Date.UTC(targetYear, targetMonth, targetDay) -
        INDIA_OFFSET_MINUTES * 60 * 1000,
    );

  const todayStart = toIndiaMidnight(year, month, day);
  const tomorrowStart = toIndiaMidnight(year, month, day + 1);
  const monthStart = toIndiaMidnight(year, month, 1);
  const nextMonthStart = toIndiaMidnight(year, month + 1, 1);

  return {
    todayStart,
    tomorrowStart,
    monthStart,
    nextMonthStart,
  };
}

function asCount(value) {
  return Number(value || 0);
}

async function getDashboardSummary({ now = new Date() } = {}) {
  const periods = getIndiaBusinessPeriods(now);
  const counts = await adminDashboardModel.getDashboardSummaryCounts(periods);

  return {
    users: {
      total: asCount(counts.total_users),
      active: asCount(counts.active_accounts),
      inactive: asCount(counts.inactive_accounts),
    },
    kyc: {
      pendingReview: asCount(counts.pending_kyc_applications),
      approvedToday: asCount(counts.kyc_approved_today),
    },
    registrations: {
      today: asCount(counts.registrations_today),
      thisMonth: asCount(counts.registrations_this_month),
    },
    period: {
      timeZone: INDIA_TIME_ZONE,
      todayStart: periods.todayStart.toISOString(),
      tomorrowStart: periods.tomorrowStart.toISOString(),
      monthStart: periods.monthStart.toISOString(),
      nextMonthStart: periods.nextMonthStart.toISOString(),
    },
    generatedAt: now.toISOString(),
  };
}

export { getIndiaBusinessPeriods, getDashboardSummary };
export default { getIndiaBusinessPeriods, getDashboardSummary };
