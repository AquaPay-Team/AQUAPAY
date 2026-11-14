import pool from "../config/db.js";
import { getRedisClient } from "../config/redis.js";

function getHealth(req, res) {
  res.status(200).json({
    success: true,
    message: "AquaPay is running"
  });
}

function createReadinessHandler({
  checkDatabase = async () => { await pool.execute("SELECT 1"); },
  checkRedis = async () => { const client = await getRedisClient(); await client.ping(); },
} = {}) {
  return async function getReadiness(req, res) {
    const checks = await Promise.allSettled([checkDatabase(), checkRedis()]);
    const dependencies = {
      mysql: checks[0].status === "fulfilled" ? "ready" : "unavailable",
      redis: checks[1].status === "fulfilled" ? "ready" : "unavailable",
    };
    const ready = Object.values(dependencies).every((status) => status === "ready");
    return res.status(ready ? 200 : 503).json({
      success: ready,
      status: ready ? "ready" : "not_ready",
      dependencies,
    });
  };
}

const getReadiness = createReadinessHandler();

export { getHealth, getReadiness, createReadinessHandler };

export default { getHealth, getReadiness, createReadinessHandler };

