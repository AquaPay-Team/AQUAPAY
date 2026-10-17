const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

const app = require("./app");
const pool = require("./config/db");
const { verifyDatabaseConnection } = pool;
const { getAuthConfig } = require("./config/auth");

async function start() {
  try {
    getAuthConfig();

    const database = await verifyDatabaseConnection();
    const port = Number(process.env.PORT || 3000);

    const server = app.listen(port, () => {
      console.log(
        `AquaPay API listening on port ${port}; database connection verified`,
      );
    });

    return server;
  } catch (error) {
    console.error("AquaPay startup failed:", error.message);
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
