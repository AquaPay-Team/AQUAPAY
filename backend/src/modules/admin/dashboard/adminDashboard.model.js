import pool from "../../../config/db.js";

/**
 * Fetches the dashboard's aggregate counts in one round trip.
 * Time-window predicates are sargable: callers supply precomputed boundaries
 * rather than applying date functions to indexed timestamp columns.
 */
async function getDashboardSummaryCounts({
  todayStart,
  tomorrowStart,
  monthStart,
  nextMonthStart,
}) {
  const [rows] = await pool.execute(
    `SELECT
       (SELECT COUNT(*) FROM users) AS total_users,
       (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_accounts,
       (SELECT COUNT(*) FROM users WHERE status = 'inactive') AS inactive_accounts,
       (
         SELECT COUNT(*)
         FROM kyc_cases
         WHERE status IN ('submitted', 'under_review')
       ) AS pending_kyc_applications,
       (
         SELECT COUNT(*)
         FROM kyc_cases
         WHERE status = 'approved'
           AND reviewed_at >= ?
           AND reviewed_at < ?
       ) AS kyc_approved_today,
       (
         SELECT COUNT(*)
         FROM users
         WHERE created_at >= ?
           AND created_at < ?
       ) AS registrations_today,
       (
         SELECT COUNT(*)
         FROM users
         WHERE created_at >= ?
           AND created_at < ?
       ) AS registrations_this_month`,
    [
      todayStart,
      tomorrowStart,
      todayStart,
      tomorrowStart,
      monthStart,
      nextMonthStart,
    ],
  );

  return rows[0] || {};
}

export { getDashboardSummaryCounts };
export default { getDashboardSummaryCounts };
