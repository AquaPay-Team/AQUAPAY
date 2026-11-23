import pool from "../../../config/db.js";
import redisConnection from "../../../config/redis.js";
import { getMonitoringSnapshot } from "../../../monitoring/operationsMonitor.js";

const PROBE_TIMEOUT_MS = 1500;

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

async function getOperationsOverview() {
  const [mysql, redis] = await Promise.all([
    probeDependency(() => pool.query({ sql: "SELECT 1 AS ok", timeout: PROBE_TIMEOUT_MS })),
    probeDependency(async () => {
      const client = await redisConnection.getRedisClient();
      await client.ping();
    }),
  ]);

  const snapshot = getMonitoringSnapshot();
  return {
    ...snapshot,
    dependencies: { mysql, redis },
    reports: {
      operational: {
        available: true,
        scope: "live_current_process",
        generatedAt: new Date().toISOString(),
      },
      historical: {
        available: false,
        reason: "Persistent metrics and log storage are not configured.",
      },
    },
  };
}

export { getOperationsOverview };
export default { getOperationsOverview };
