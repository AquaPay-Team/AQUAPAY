import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import app from "./app.js";
import pool, { verifyDatabaseConnection } from "./config/db.js";
import redisConnection from "./config/redis.js";
import { getAuthConfig } from "./config/auth.js";

async function start() {
  try {
    // Validate auth configuration early
    getAuthConfig();

    // Verify DB connection before starting server
    await verifyDatabaseConnection();
    const port = Number(process.env.PORT || 3000);

    const server = app.listen(port, () => {
      console.log(
        `AquaPay API listening on port ${port}; database connection verified`,
      );
    });

    return server;
  } catch (error) {
    console.error("AquaPay startup failed:", error.message);
    // Ensure pool is closed if it was created
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return null;
  }
}

function installGracefulShutdown(server) {
  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`AquaPay received ${signal}; shutting down`);
    server.close(async (serverError) => {
      const results = await Promise.allSettled([
        pool.end(),
        redisConnection.closeRedisConnection(),
      ]);
      if (serverError || results.some((result) => result.status === "rejected")) {
        process.exitCode = 1;
      }
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

// Start server only when this file is executed directly (not imported)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  start().then((server) => {
    if (server) installGracefulShutdown(server);
  });
}

export { start, installGracefulShutdown };
export default { start, installGracefulShutdown };
