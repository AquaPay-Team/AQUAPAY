import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import pool, { verifyDatabaseConnection } from "./config/db.js";
import redisConnection from "./config/redis.js";
import { getAuthConfig } from "./config/auth.js";
import { assertDigiLockerSignaturePolicy } from "./modules/kyc/document-verification/digilocker/digilocker.signatureConfig.js";
import { assertIdentityEncryptionConfiguration } from "./modules/kyc/document-verification/identity-data/identityData.crypto.js";

async function start() {
  try {
    const signaturePolicy = assertDigiLockerSignaturePolicy(process.env);
    assertIdentityEncryptionConfiguration(process.env);

    // Validate auth configuration early
    getAuthConfig();

    // Load routes only after dotenv has populated the environment. DigiLocker selects
    // its real or mock provider and registers the mock-only route during module load.
    const { default: app } = await import("./app.js");

    // Verify DB connection before starting server
    await verifyDatabaseConnection();
    const { default: digilockerModel } = await import("./modules/kyc/document-verification/digilocker/digilocker.model.js");
    await digilockerModel.assertNoDevelopmentUnverifiedRecords();
    const port = Number(process.env.PORT || 3000);

    const { default: digilockerProvider } = await import("./modules/kyc/document-verification/digilocker/digilocker.provider.js");
    console.info(
      `AquaPay DigiLocker provider: ${digilockerProvider.mode}; XML signature policy: ${signaturePolicy.mode}`,
    );
    if (signaturePolicy.developmentOnly) {
      console.warn("DigiLocker results will be marked development-only and cryptographically unverified");
    }

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
