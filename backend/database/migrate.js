import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConfig } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const BASELINE_MIGRATIONS = [
  "001_initial_schema.sql",
  "002_auth_security_tables.sql",
];

// Required tables and columns used to validate the existing schema.
// This is a baseline sanity check, not a complete constraint comparison.
const REQUIRED_COLUMNS = {
  roles: ["id", "name", "slug"],
  companies: ["id", "name", "created_at"],
  users: [
    "id",
    "name",
    "email",
    "mobile",
    "company_id",
    "role_id",
    "parent_id",
    "password_hash",
    "status",
    "created_at",
    "updated_at",
  ],
  role_hierarchy: ["parent_role_id", "child_role_id"],
  auth_password_reset_tokens: [
    "id",
    "user_id",
    "token_hash",
    "expires_at",
    "used_at",
    "created_at",
  ],
  auth_rate_limits: [
    "bucket_hash",
    "window_start",
    "request_count",
    "expires_at",
  ],
};

async function ensureMigrationTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
      DEFAULT CHARSET=utf8mb4
      COLLATE=utf8mb4_0900_ai_ci
  `);
}

async function getAppliedMigrations(connection) {
  const [rows] = await connection.query(
    "SELECT migration FROM schema_migrations",
  );
  return new Set(rows.map((row) => row.migration));
}

async function validateExistingSchema(connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'`,
  );

  const existingTables = new Set(tables.map((row) => row.TABLE_NAME));
  const missingTables = Object.keys(REQUIRED_COLUMNS).filter(
    (table) => !existingTables.has(table),
  );

  if (missingTables.length) {
    throw new Error(
      `Cannot baseline: missing tables: ${missingTables.join(", ")}`,
    );
  }

  for (const [table, requiredColumns] of Object.entries(REQUIRED_COLUMNS)) {
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = ?`,
      [table],
    );

    const actualColumns = new Set(columns.map((row) => row.COLUMN_NAME));
    const missingColumns = requiredColumns.filter(
      (column) => !actualColumns.has(column),
    );

    if (missingColumns.length) {
      throw new Error(
        `Cannot baseline ${table}: missing columns: ${missingColumns.join(", ")}`,
      );
    }
  }

  console.log("Baseline sanity checks passed.");
  console.warn(
    "Note: this checks required tables and columns, not every index, " +
      "foreign key, or column definition. Compare the live schema with " +
      "the original SQL before accepting the baseline.",
  );
}

async function baselineExistingDatabase(connection) {
  const applied = await getAppliedMigrations(connection);
  const alreadyRecorded = BASELINE_MIGRATIONS.filter((name) =>
    applied.has(name),
  );

  if (alreadyRecorded.length) {
    throw new Error(
      `Baseline stopped: records already exist for ${alreadyRecorded.join(", ")}.`,
    );
  }

  await validateExistingSchema(connection);

  // Do not baseline until the full schema comparison has been reviewed.
  if (!process.argv.includes("--confirm-schema-reviewed")) {
    throw new Error(
      "Schema sanity checks passed, but full schema review is still required. " +
        "Compare live columns, indexes, and foreign keys with migrations 001/002. " +
        "Then rerun with --confirm-schema-reviewed if they match.",
    );
  }

  for (const migration of BASELINE_MIGRATIONS) {
    await connection.query(
      "INSERT INTO schema_migrations (migration) VALUES (?)",
      [migration],
    );
    console.log(`Baselined existing migration: ${migration}`);
  }
}

async function runSeeds(connection) {
  const seedsDir = path.join(__dirname, "seeds");
  if (!fs.existsSync(seedsDir)) return;

  const files = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} seed file(s).`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(seedsDir, file), "utf8");
    console.log(`Running seed: ${file}...`);
    await connection.query(sql);
    console.log(`Seed completed: ${file}`);
  }
}

async function runMigrations() {
  const config = getDatabaseConfig();
  console.log(`Connecting to database ${config.database} on ${config.host}...`);

  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: true,
  });

  try {
    await ensureMigrationTable(connection);

    if (process.argv.includes("--baseline-existing")) {
      if (config.database !== "fintech_kyc") {
        throw new Error(
          "Baseline command is restricted to the expected database fintech_kyc.",
        );
      }

      await baselineExistingDatabase(connection);
      console.log("Existing database baseline completed.");
      return;
    }

    const applied = await getAppliedMigrations(connection);
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      if (BASELINE_MIGRATIONS.includes(file)) {
        throw new Error(
          `Migration ${file} is not recorded. Review the existing database ` +
            "and establish its baseline before running migrations.",
        );
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      console.log(`Running migration: ${file}...`);
      await connection.query(sql);

      await connection.query(
        "INSERT INTO schema_migrations (migration) VALUES (?)",
        [file],
      );

      console.log(`Migration completed and recorded: ${file}`);
    }

    if (process.argv.includes("--seed")) {
      await runSeeds(connection);
    }

    console.log("All pending migrations executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runMigrations();
}

export { runMigrations, runSeeds };
export default { runMigrations, runSeeds };
