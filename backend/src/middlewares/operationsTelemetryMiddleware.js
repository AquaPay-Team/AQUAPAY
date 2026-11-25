import pool from "../config/db.js";
import redisConnection from "../config/redis.js";

/**
 * Lightweight, non-blocking request telemetry middleware.
 *
 * On every response finish it increments Redis counters for the current
 * hourly bucket (total_requests, 4xx, 5xx, total latency). A separate
 * flush function (also exported) moves those counters into the MySQL
 * api_request_metrics table using INSERT ... ON DUPLICATE KEY UPDATE so
 * every API request updates persistent storage without blocking the
 * HTTP response. Redis unavailability is swallowed so the middleware
 * can never delay or fail a response.
 */

const FLUSH_INTERVAL_MS = 30_000;
let flushTimer = null;

function pad(n) {
  return String(n).padStart(2, "0");
}

/** Truncate a Date to the start of its UTC hour. */
function currentBucketHour() {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours()),
  );
}

/** Format a Date as a MySQL DATETIME string (YYYY-MM-DD HH:MM:SS). */
function formatForMySQL(date) {
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

/** Format a bucket-hour Date as a Redis key suffix. */
function bucketKey(bucketHour) {
  return `op:metrics:${formatForMySQL(bucketHour)}`;
}

function operationsTelemetryMiddleware(req, res, next) {
  const requestStartedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - requestStartedAt) / 1e6;
    const statusCode = res.statusCode || 0;
    const key = bucketKey(currentBucketHour());

    // Fire-and-forget Redis batching. Never blocks the response.
    (async () => {
      try {
        const client = await redisConnection.getRedisClient();
        await client.hIncrBy(key, "total_requests", 1);
        if (statusCode >= 500) await client.hIncrBy(key, "error_5xx_count", 1);
        else if (statusCode >= 400) await client.hIncrBy(key, "error_4xx_count", 1);
        await client.hIncrByFloat(key, "total_latency_ms", latencyMs);
        await client.expire(key, 7 * 24 * 60 * 60); // 7-day TTL
      } catch {
        // Redis unavailable — skip batching for this request.
      }
    })();
  });

  next();
}

/**
 * Flush accumulated Redis telemetry buckets into MySQL api_request_metrics.
 * Idempotent and safe to call on every overview read plus on a timer.
 */
async function flushTelemetryToMySQL() {
  let client;
  try {
    client = await redisConnection.getRedisClient();
    const keys = await client.keys("op:metrics:*");
    if (!keys.length) return;

    for (const key of keys) {
      const fields = await client.hGetAll(key);
      const bucketHour = key.replace("op:metrics:", "");

      await pool.query(
        `INSERT INTO api_request_metrics
          (bucket_hour, total_requests, error_5xx_count, error_4xx_count, total_latency_ms)
        VALUES (?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          total_requests = total_requests + VALUES(total_requests),
          error_5xx_count = error_5xx_count + VALUES(error_5xx_count),
          error_4xx_count = error_4xx_count + VALUES(error_4xx_count),
          total_latency_ms = total_latency_ms + VALUES(total_latency_ms)`,
        [
          bucketHour,
          Number(fields.total_requests || 0),
          Number(fields.error_5xx_count || 0),
          Number(fields.error_4xx_count || 0),
          Math.round(Number(fields.total_latency_ms || 0)),
        ],
      );

      await client.del(key);
    }
  } catch {
    // Redis or MySQL unavailable — leave data in Redis for the next flush.
  }
}

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flushTelemetryToMySQL, FLUSH_INTERVAL_MS);
  if (flushTimer.unref) flushTimer.unref();
}

// Begin periodic flushing once the module is loaded.
startFlushTimer();

export { operationsTelemetryMiddleware, flushTelemetryToMySQL };
