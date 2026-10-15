require("dotenv").config();

const app = require("./app");
const pool = require("./config/db");
const { verifyOracleMySql } = pool;
const { getAuthConfig } = require("./config/auth");

async function start() {
  try {
    getAuthConfig();
    const database = await verifyOracleMySql();
    const port = Number(process.env.PORT || 3000);
    const server = app.listen(port, () => {
      console.log(`AquaPay API listening on port ${port}; Oracle MySQL ${database.version} verified`);
    });
    return server;
  } catch (error) {
    const code = typeof error.code === "string" && /^[A-Z0-9_]{1,64}$/.test(error.code)
      ? error.code
      : "STARTUP_FAILED";
    console.error("AquaPay startup failed", { code });
    await pool.end().catch(() => {});
    process.exitCode = 1;
    return null;
  }
}

if (require.main === module) {
  start();
}

module.exports = { start };
