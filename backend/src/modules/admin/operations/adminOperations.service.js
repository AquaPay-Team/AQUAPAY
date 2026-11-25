import pool from "../../../config/db.js";
import redisConnection from "../../../config/redis.js";
import { getMonitoringSnapshot } from "../../../monitoring/operationsMonitor.js";
import { flushTelemetryToMySQL } from "../../../middlewares/operationsTelemetryMiddleware.js";

const PROBE_TIMEOUT_MS = 1500;

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatForMySQL(date) {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

async function probeDependency(probe) {
  const checkedAt = new Date().toISOString();
  const startedAt = process.hrtime.bigint();
  let timeoutId;

  try {
    await Promise.race([
      probe(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("probe timed out")), PROBE_TIMEOUT_MS);
      }),
    ]);
    return {
      status: "ready",
      checkedAt,
      latencyMs: Math.round(Number(process.hrtime.bigint() - startedAt) / 1e6),
    };
  } catch {
    return { status: "unavailable", checkedAt };
  } finally {
    clearTimeout(timeoutId);
  }
}

function asCount(value) {
  return Number(value || 0);
}

function ratePercent(numerator, denominator) {
  if (!denominator) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

async function fetchPersistedMetrics(now) {
  const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const aggregatesSql = `
    SELECT
      COALESCE(SUM(total_requests), 0) AS total_requests,
      COALESCE(SUM(error_5xx_count), 0) AS error_5xx_count,
      COALESCE(SUM(error_4xx_count), 0) AS error_4xx_count,
      COALESCE(SUM(total_latency_ms), 0) AS total_latency_ms,
      COUNT(*) AS buckets
  `;

  const [last24hRows] = await pool.query(
    `${aggregatesSql} FROM api_request_metrics WHERE bucket_hour >= ? AND bucket_hour < ?`,
    [formatForMySQL(day24hAgo), formatForMySQL(now)],
  );
  const [last7dRows] = await pool.query(
    `${aggregatesSql} FROM api_request_metrics WHERE bucket_hour >= ? AND bucket_hour < ?`,
    [formatForMySQL(day7dAgo), formatForMySQL(now)],
  );
  const [hourlyRows] = await pool.query(
    `SELECT bucket_hour, total_requests, error_5xx_count, error_4xx_count, total_latency_ms
     FROM api_request_metrics
     WHERE bucket_hour >= ? AND bucket_hour < ?
     ORDER BY bucket_hour ASC`,
    [formatForMySQL(day24hAgo), formatForMySQL(now)],
  );

  const r24 = last24hRows[0] || {};
  const r7 = last7dRows[0] || {};
  const total24 = asCount(r24.total_requests);
  const total7 = asCount(r7.total_requests);

  return {
    available: true,
    scope: "persisted_mysql",
    generatedAt: now.toISOString(),
    last24Hours: {
      totalRequests: total24,
      avgLatencyMs: total24 ? Math.round(asCount(r24.total_latency_ms) / total24) : null,
      error5xxCount: asCount(r24.error_5xx_count),
      error5xxRate: ratePercent(asCount(r24.error_5xx_count), total24),
      error4xxCount: asCount(r24.error_4xx_count),
    },
    last7Days: {
      totalRequests: total7,
      avgLatencyMs: total7 ? Math.round(asCount(r7.total_latency_ms) / total7) : null,
      error5xxCount: asCount(r7.error_5xx_count),
      error5xxRate: ratePercent(asCount(r7.error_5xx_count), total7),
      error4xxCount: asCount(r7.error_4xx_count),
    },
    hourlyBreakdown: (hourlyRows || []).map((row) => ({
      bucketHour: row.bucket_hour,
      totalRequests: asCount(row.total_requests),
      error5xxCount: asCount(row.error_5xx_count),
      error4xxCount: asCount(row.error_4xx_count),
      avgLatencyMs: asCount(row.total_requests)
        ? Math.round(asCount(row.total_latency_ms) / asCount(row.total_requests))
        : null,
    })),
  };
}

async function fetchPlatformActivity(now) {
  const day24hAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const day7dAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [rows] = await pool.query(
    `SELECT
      (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS users_24h,
      (SELECT COUNT(*) FROM users WHERE created_at >= ?) AS users_7d,
      (SELECT COUNT(*) FROM kyc_cases WHERE created_at >= ?) AS kyc_submissions_24h,
      (SELECT COUNT(*) FROM kyc_cases WHERE created_at >= ? AND status = 'approved') AS kyc_approvals_24h`,
    [
      formatForMySQL(day24hAgo),
      formatForMySQL(day7dAgo),
      formatForMySQL(day24hAgo),
      formatForMySQL(day24hAgo),
    ],
  );

  return rows[0] || {};
}

async function getOperationsOverview() {
  const [mysql, redis] = await Promise.all([
    probeDependency(() => pool.query({ sql: "SELECT 1 AS ok", timeout: PROBE_TIMEOUT_MS })),
    probeDependency(async () => {
      const client = await redisConnection.getRedisClient();
      await client.ping();
    }),
  ]);

  const snapshot = getMonitoringSnapshot();

  // Flush any pending Redis telemetry into MySQL so this read reflects the
  // most recent persisted data. Non-fatal if storage is unavailable.
  try {
    await flushTelemetryToMySQL();
  } catch {
    // Flush failure is non-fatal; continue with live snapshot.
  }

  let operationalReports = {
    available: false,
    reason: "Persistent metrics storage is not configured.",
    scope: "live_current_process",
    generatedAt: new Date().toISOString(),
  };
  let platformActivity = {};

  try {
    operationalReports = await fetchPersistedMetrics(new Date());
  } catch {
    // Table may not exist yet (migration not run) — fall back to live-only.
  }

  try {
    platformActivity = await fetchPlatformActivity(new Date());
  } catch {
    // Platform activity query failure is non-fatal.
  }

  return {
    ...snapshot,
    dependencies: { mysql, redis },
    reports: {
      operational: operationalReports,
      historical: {
        available: operationalReports.available,
        reason: operationalReports.available ? null : "Persistent metrics storage is not configured.",
      },
      platformActivity,
    },
  };
}

export { getOperationsOverview };
export default { getOperationsOverview };
