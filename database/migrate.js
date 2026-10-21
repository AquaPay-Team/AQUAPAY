import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConfig } from "../src/config/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function runSeeds(connection) {
  const seedsDir = path.join(__dirname, "seeds");
  if (!fs.existsSync(seedsDir)) return;

  const files = fs
    .readdirSync(seedsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  console.log(`Found ${files.length} seed file(s).`);
  for (const file of files) {
    const filePath = path.join(seedsDir, file);
    const sql = fs.readFileSync(filePath, "utf-8");
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
    const migrationsDir = path.join(__dirname, "migrations");
    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    console.log(`Found ${files.length} migration file(s).`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, "utf-8");
      console.log(`Running migration: ${file}...`);
      await connection.query(sql);
      console.log(`Migration completed: ${file}`);
    }

    if (process.argv.includes("--seed")) {
      await runSeeds(connection);
    }

    console.log("All migrations executed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] === __filename) {
  runMigrations();
}

export { runMigrations, runSeeds };
export default { runMigrations, runSeeds };
