import pool from "../../config/db.js";
import bcrypt from "bcryptjs";
import { normalizeMobile } from "../../utils/validationHelper.js";
import { getPasswordConfig } from "../../config/auth.js";

async function createAdmin(adminInput) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Normalize mobile number before database operations
    const normalizedMobile = normalizeMobile(adminInput.mobile);

    // Check whether an Admin already exists
    const [existingAdmins] = await connection.execute(
      "SELECT id FROM users WHERE role_id = 1 LIMIT 1",
    );

    if (existingAdmins.length > 0) {
      const error = new Error("An Admin account already exists");
      error.statusCode = 409;
      throw error;
    }

    // Find existing company
    const [companies] = await connection.execute(
      "SELECT id FROM companies WHERE name = ? LIMIT 1",
      [adminInput.companyName],
    );

    let companyId;

    if (companies.length > 0) {
      companyId = companies[0].id;
    } else {
      const [companyResult] = await connection.execute(
        "INSERT INTO companies (name) VALUES (?)",
        [adminInput.companyName],
      );

      companyId = companyResult.insertId;
    }

    // Check for duplicate email or normalized mobile
    const [existingUsers] = await connection.execute(
      "SELECT id FROM users WHERE email = ? OR mobile = ? LIMIT 1",
      [adminInput.email, normalizedMobile],
    );

    if (existingUsers.length > 0) {
      const error = new Error("Email or mobile already in use");
      error.statusCode = 409;
      throw error;
    }

    // Validate password before hashing
    const passwordConfig = getPasswordConfig();
    if (
      typeof adminInput.password !== "string" ||
      adminInput.password.length < passwordConfig.passwordMinLength ||
      Buffer.byteLength(adminInput.password, "utf8") > 72
    ) {
      const error = new Error(
        typeof adminInput.password !== "string" || !adminInput.password
          ? "Password is required"
          : adminInput.password.length < passwordConfig.passwordMinLength
            ? `Password must be at least ${passwordConfig.passwordMinLength} characters`
            : "Password must not exceed 72 bytes",
      );
      error.statusCode = 400;
      throw error;
    }

    // Hash Admin password using configured salt rounds
    const passwordHash = await bcrypt.hash(
      adminInput.password,
      passwordConfig.bcryptSaltRounds,
    );

    // Create Admin
    const [result] = await connection.execute(
      `INSERT INTO users
        (name, email, mobile, company_id, role_id, parent_id,
         password_hash, status)
       VALUES (?, ?, ?, ?, 1, NULL, ?, 'active')`,
      [
        adminInput.name,
        adminInput.email,
        normalizedMobile,
        companyId,
        passwordHash,
      ],
    );

    await connection.commit();

    return {
      id: result.insertId,
      name: adminInput.name,
      email: adminInput.email,
      companyId,
      roleId: 1,
      status: "active",
    };
  } catch (error) {
    await connection.rollback();

    if (error.code === "ER_DUP_ENTRY") {
      error.statusCode = 409;
      error.message = "An account with this email or mobile already exists";
    }

    throw error;
  } finally {
    connection.release();
  }
}

const adminService = {
  createAdmin,
};

export { createAdmin };
export default adminService;
