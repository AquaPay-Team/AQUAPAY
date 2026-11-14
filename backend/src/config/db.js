import "dotenv/config";
import mysql from "mysql2/promise";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// backend/src/config -> backend
const backendRoot = path.resolve(__dirname, "../..");

function getDatabaseConfig() {
  const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((name) => !process.env[name]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required database configuration: ${missing.join(", ")}`,
    );
  }

  const port = Number(process.env.DB_PORT);

  if (
    !/^[1-9]\d*$/.test(process.env.DB_PORT) ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new Error("DB_PORT must be a valid TCP port");
  }

  if (
    /replace|change.?me|placeholder|example/i.test(process.env.DB_USER) ||
    /replace|change.?me|placeholder|example/i.test(process.env.DB_PASSWORD)
  ) {
    throw new Error(
      "DB_USER and DB_PASSWORD must be configured with non-placeholder values",
    );
  }

  if (!/^[A-Za-z0-9_]+$/.test(process.env.DB_NAME)) {
    throw new Error("DB_NAME contains unsupported characters");
  }

  // SSL is enabled when DB_SSL_CA points to a CA certificate.
  // Relative paths are resolved from the backend directory.
  let ssl;

  const sslCaPath = process.env.DB_SSL_CA?.trim();

  if (sslCaPath) {
    const resolvedCaPath = path.resolve(backendRoot, sslCaPath);

    if (!fs.existsSync(resolvedCaPath)) {
      throw new Error(`Database SSL CA certificate not found: ${resolvedCaPath}`);
    }

    ssl = {
      ca: fs.readFileSync(resolvedCaPath),
      rejectUnauthorized: true,
    };
  }

  return {
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ...(ssl ? { ssl } : {}),
  };
}

const pool = mysql.createPool({
  ...getDatabaseConfig(),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function verifyDatabaseConnection() {
  const [rows] = await pool.query(
    "SELECT VERSION() AS version, @@version_comment AS versionComment",
  );

  return {
    version: rows[0].version,
    versionComment: rows[0].versionComment,
  };
}

async function verifyOracleMySql() {
  const metadata = await verifyDatabaseConnection();
  const versionComment = String(metadata.versionComment || "");
  const version = String(metadata.version || "");

  if (
    /mariadb/i.test(versionComment) ||
    /mariadb/i.test(version) ||
    !/^\d+\.\d+\.\d+/.test(version)
  ) {
    throw new Error("Database server is not Oracle MySQL or a supported MySQL server");
  }

  return metadata;
}

pool.getDatabaseConfig = getDatabaseConfig;
pool.verifyDatabaseConnection = verifyDatabaseConnection;
pool.verifyOracleMySql = verifyOracleMySql;

export { getDatabaseConfig, verifyDatabaseConnection, verifyOracleMySql };
export default pool;
