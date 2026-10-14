const pool = require("./db");

async function testDatabaseConnection() {
    try {
        const [rows] = await pool.query(
            "SELECT DATABASE() AS databaseName, VERSION() AS mysqlVersion"
        );

        console.log("Database connected successfully!");
        console.log("Database:", rows[0].databaseName);
        console.log("MySQL version:", rows[0].mysqlVersion);
    } catch (error) {
        console.error("Database connection failed:", error.message);
    } finally {
        await pool.end();
    }
}

testDatabaseConnection();