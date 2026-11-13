import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";
import { getDatabaseConfig } from "../src/config/db.js";
import { runSeeds } from "./migrate.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function seed() {
  const config = getDatabaseConfig();
  console.log(`Connecting to database ${config.database} on ${config.host} for seeding...`);

  const connection = await mysql.createConnection({
    ...config,
    multipleStatements: true,
  });

  try {
    await runSeeds(connection);
    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed:", error);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

if (process.argv[1] === __filename) {
  seed();
}

export { seed };
export default { seed };
