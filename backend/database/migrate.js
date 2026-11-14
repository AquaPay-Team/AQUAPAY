import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "..");

// Load backend/.env explicitly, regardless of the terminal's working directory.
dotenv.config({ path: path.join(backendRoot, ".env") });

const BASELINE_MIGRATIONS = [
  "001_initial_schema.sql",
  "002_auth_security_tables.sql",
];

const EXPECTED_DATABASE = "fintech_kyc";

// Required tables and columns for the existing-database baseline check.
// This is a sanity check, not a complete schema equivalence check.
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

function getMigrationFiles() {
  const migrationsDir = path.join(__dirname, "migrations");

  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

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

async function getApplicationTables(connection) {
  const [rows] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'
        AND TABLE_NAME <> 'schema_migrations'`,
  );

  return rows.map((row) => row.TABLE_NAME);
}

async function validateMigrationState(connection, applied, files) {
  const applicationTables = await getApplicationTables(connection);

  // Fresh database: no application tables and no migration history.
  if (applied.size === 0 && applicationTables.length === 0) {
    console.log(
      "Fresh database detected. Initial migrations are allowed.",
    );
    return;
  }

  // Never mistake an existing schema without migration history for
  // a fresh database.
  if (applied.size === 0 && applicationTables.length > 0) {
    throw new Error(
      "Application tables exist but no migrations are recorded. " +
        "Stop and review the existing schema before proceeding.",
    );
  }

  // Every recorded migration must still exist in the repository.
  const unknownMigrations = [...applied].filter(
    (migration) => !files.includes(migration),
  );

  if (unknownMigrations.length > 0) {
    throw new Error(
      `Unknown migration records found: ${unknownMigrations.join(", ")}. ` +
        "Check the repository migration history before proceeding.",
    );
  }

  // Required baseline migration files must exist.
  for (const baseline of BASELINE_MIGRATIONS) {
    if (!files.includes(baseline)) {
      throw new Error(`Required baseline migration is missing: ${baseline}`);
    }
  }

  // Migration history must follow repository order without gaps.
  let foundPendingMigration = false;

  for (const file of files) {
    if (!applied.has(file)) {
      foundPendingMigration = true;
      continue;
    }

    if (foundPendingMigration) {
      throw new Error(
        `Invalid migration history: ${file} is recorded even though an ` +
          "earlier migration is missing. Review the database before proceeding.",
      );
    }
  }

  // Existing migration records must begin with migration 001.
  if (
    applied.size > 0 &&
    !applied.has("001_initial_schema.sql")
  ) {
    throw new Error(
      "Invalid migration history: migration 001 is not recorded.",
    );
  }

  console.log("Migration history checks passed.");
}

async function validateExistingSchema(connection) {
  const [tables] = await connection.query(
    `SELECT TABLE_NAME
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_TYPE = 'BASE TABLE'`,
  );

  const existingTables = new Set(
    tables.map((row) => row.TABLE_NAME),
  );

  const missingTables = Object.keys(REQUIRED_COLUMNS).filter(
    (table) => !existingTables.has(table),
  );

  if (missingTables.length > 0) {
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

    const actualColumns = new Set(
      columns.map((row) => row.COLUMN_NAME),
    );

    const missingColumns = requiredColumns.filter(
      (column) => !actualColumns.has(column),
    );

    if (missingColumns.length > 0) {
      throw new Error(
        `Cannot baseline ${table}: missing columns: ${missingColumns.join(", ")}`,
      );
    }
  }

  console.log("Baseline sanity checks passed.");

  console.warn(
    "This check validates required tables and columns only. " +
      "It does not prove that indexes, foreign keys, column types, " +
      "defaults, or constraints match the original SQL.",
  );
}

async function baselineExistingDatabase(connection) {
  const applied = await getAppliedMigrations(connection);

  const alreadyRecorded = BASELINE_MIGRATIONS.filter(
    (name) => applied.has(name),
  );
  if (applied.size > 0) {
    throw new Error(
      "Baseline stopped: migration records already exist. " +
        "Review migration history before attempting a baseline.",
    );
  }

  if (alreadyRecorded.length > 0) {
    throw new Error(
      `Baseline stopped: records already exist for ${alreadyRecorded.join(", ")}.`,
    );
  }

  const applicationTables = await getApplicationTables(connection);

  if (applicationTables.length === 0) {
    throw new Error(
      "Cannot baseline an empty database. Use the normal migration process.",
    );
  }

  await validateExistingSchema(connection);

  if (!process.argv.includes("--confirm-schema-reviewed")) {
    throw new Error(
      "Schema sanity checks passed, but full schema review is still required. " +
        "Compare the live columns, indexes, foreign keys, and definitions " +
        "with migrations 001/002 before using --confirm-schema-reviewed.",
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

  if (!fs.existsSync(seedsDir)) {
    console.log("No seeds directory found. Skipping seeds.");
    return;
  }

  const files = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} seed file(s).`);

  for (const file of files) {
    const seedPath = path.join(seedsDir, file);
    const sql = fs.readFileSync(seedPath, "utf8");

    console.log(`Running seed: ${file}...`);

    await connection.query(sql);

    console.log(`Seed completed: ${file}`);
  }
}

async function runMigrations() {
  let connection;

  try {
    // Dynamic import ensures backend/.env is loaded before db.js
    // creates its database pool/configuration.
    const { getDatabaseConfig } = await import(
      "../src/config/db.js"
    );

    const config = getDatabaseConfig();

    // Current SQL migrations explicitly target fintech_kyc.
    // Prevent accidentally running them against another database.
    if (config.database !== EXPECTED_DATABASE) {
      throw new Error(
        `Migration execution is restricted to ${EXPECTED_DATABASE}. ` +
          `Configured database: ${config.database}`,
      );
    }

    const files = getMigrationFiles();

    for (const baseline of BASELINE_MIGRATIONS) {
      if (!files.includes(baseline)) {
        throw new Error(`Required baseline migration is missing: ${baseline}`);
      }
    }

    console.log(
      `Connecting to database ${config.database} on ${config.host}...`,
    );

    connection = await mysql.createConnection({
      ...config,
      multipleStatements: true,
    });

    await ensureMigrationTable(connection);

    if (process.argv.includes("--baseline-existing")) {
      await baselineExistingDatabase(connection);
      console.log("Existing database baseline completed.");
      return;
    }

    const applied = await getAppliedMigrations(connection);

    await validateMigrationState(connection, applied, files);

    for (const file of files) {
      if (applied.has(file)) {
        console.log(`Skipping already applied migration: ${file}`);
        continue;
      }

      const migrationPath = path.join(__dirname, "migrations", file);
      const sql = fs.readFileSync(migrationPath, "utf8");

      console.log(`Running migration: ${file}...`);

      // MySQL DDL can auto-commit. A failure may leave partial changes.
      // The migration is recorded only after the complete SQL succeeds.
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
    if (connection) {
      await connection.end();
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === __filename
) {
  await runMigrations();
}

export { runMigrations, runSeeds };
export default { runMigrations, runSeeds };
