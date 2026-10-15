const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

function getDatabaseConfig() {
  const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_PASSWORD", "DB_NAME"];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing required database configuration: ${missing.join(", ")}`);
  }

  const port = Number(process.env.DB_PORT);
  if (!/^[1-9]\d*$/.test(process.env.DB_PORT) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("DB_PORT must be a valid TCP port");
  }

  if (/replace|change.?me|placeholder|example/i.test(process.env.DB_USER) ||
      /replace|change.?me|placeholder|example/i.test(process.env.DB_PASSWORD)) {
    throw new Error("DB_USER and DB_PASSWORD must be configured with non-placeholder values");
  }

  if (!/^[A-Za-z0-9_]+$/.test(process.env.DB_NAME)) {
    throw new Error("DB_NAME contains unsupported characters");
  }

  return {
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  };
}

async function verifyOracleMySql() {
  getDatabaseConfig();
  const [rows] = await pool.query(
    "SELECT VERSION() AS version, @@version_comment AS versionComment"
  );
  const versionComment = rows[0]?.versionComment || "";
  if (/mariadb/i.test(versionComment) || !/^MySQL (Community|Enterprise) Server\b/i.test(versionComment)) {
    throw new Error("The configured database server is not Oracle MySQL");
  }

  return { version: rows[0].version, versionComment };
}

module.exports = pool;
module.exports.getDatabaseConfig = getDatabaseConfig;
module.exports.verifyOracleMySql = verifyOracleMySql;
