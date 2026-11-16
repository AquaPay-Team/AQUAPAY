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
import { assertIdentityEncryptionConfiguration } from "./modules/kyc/document-verification/shared/identityData.crypto.js";
import { assertProviderSessionEncryptionConfiguration } from "./modules/kyc/document-verification/shared/providerSession.crypto.js";
import logger from "./utils/logger.js";

async function start() {
  try {
    process.env.NODE_ENV ||= "production";
    const signaturePolicy = assertDigiLockerSignaturePolicy(process.env);
    assertIdentityEncryptionConfiguration(process.env);
    assertProviderSessionEncryptionConfiguration();

    // Validate auth configuration early
    getAuthConfig();

    // Load routes only after dotenv has populated the environment. DigiLocker selects
    // its real or mock provider and registers the mock-only route during module load.
    const { default: app } = await import("./app.js");

    // Verify DB connection before starting server
    await verifyDatabaseConnection();
    const { default: digilockerModel } = await import("./modules/kyc/document-verification/digilocker/digilocker.model.js");
    await digilockerModel.assertSessionSchema();
    await digilockerModel.assertNoDevelopmentUnverifiedRecords();
    const port = Number(process.env.PORT || 3000);

    const { default: digilockerProvider } = await import("./modules/kyc/document-verification/digilocker/digilocker.provider.js");
    logger.info("server.digilocker_provider_configured", {
      providerMode: digilockerProvider.mode,
      aadhaarXmlCryptographicVerification: "not_performed",
      legacyXmlSignaturePolicy: signaturePolicy.mode,
    });
    if (signaturePolicy.developmentOnly) {
      logger.warn("server.legacy_xml_signature_verification_is_development_only");
    }

    const server = app.listen(port, () => {
      logger.info("server.listening", { port, databaseConnection: "verified" });
    });

    return server;
  } catch (error) {
    logger.error("server.startup_failed", {
      errorName: error?.name || "Error",
      code: typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code) ? error.code : undefined,
    });
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
    logger.info("server.shutdown_requested", { signal });
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
