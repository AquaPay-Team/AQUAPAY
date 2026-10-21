import pool from "../../config/db.js";

const SAFE_USER_FIELDS = `u.id, u.name AS name, u.email, u.mobile,
  u.role_id, u.company_id, u.parent_id AS parent_id, u.status,
  r.name AS role_name, c.name AS company_name`;

async function findUserByIdentifier(identifier, type) {
  const column = type === "email" ? "email" : "mobile";
  const [rows] = await pool.execute(
    `SELECT ${SAFE_USER_FIELDS}, u.password_hash
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.${column} = ?
     LIMIT 1`,
    [identifier],
  );
  return rows[0] || null;
}

async function findActiveUserById(userId) {
  const [rows] = await pool.execute(
    `SELECT ${SAFE_USER_FIELDS}, u.created_at
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function isUserActive(userId) {
  const [rows] = await pool.execute(
    "SELECT id FROM users WHERE id = ? AND status = 'active' LIMIT 1",
    [userId],
  );
  return rows.length > 0;
}

async function incrementRateLimitCounter(bucketHash, windowStart, expiresAt) {
  await pool.execute(
    `INSERT INTO auth_rate_limits (bucket_hash, window_start, request_count, expires_at)
     VALUES (?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
    [bucketHash, windowStart, expiresAt],
  );
  const [rows] = await pool.execute(
    `SELECT request_count FROM auth_rate_limits
     WHERE bucket_hash = ? AND window_start = ? LIMIT 1`,
    [bucketHash, windowStart],
  );
  return rows[0]?.request_count || 0;
}

async function createPasswordReset({ userId, tokenHash, ttlMinutes }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [
      userId,
    ]);
    await connection.execute(
      `UPDATE auth_password_reset_tokens SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [userId],
    );
    const [result] = await connection.execute(
      `INSERT INTO auth_password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(UTC_TIMESTAMP(), INTERVAL ? MINUTE))`,
      [userId, tokenHash, ttlMinutes],
    );
    const [rows] = await connection.execute(
      "SELECT expires_at FROM auth_password_reset_tokens WHERE id = ? LIMIT 1",
      [result.insertId],
    );
    await connection.commit();
    return rows[0]?.expires_at;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function hasValidPasswordReset(tokenHash) {
  const [rows] = await pool.execute(
    `SELECT id FROM auth_password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()
     LIMIT 1`,
    [tokenHash],
  );
  return rows.length > 0;
}

async function consumePasswordReset({ tokenHash, passwordHash }) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [candidates] = await connection.execute(
      `SELECT token.user_id, account.email, account.mobile
       FROM auth_password_reset_tokens token
       JOIN users account ON account.id = token.user_id
       WHERE token.token_hash = ? LIMIT 1`,
      [tokenHash],
    );
    if (!candidates[0]) {
      await connection.commit();
      return null;
    }

    const userId = candidates[0].user_id;
    await connection.execute("SELECT id FROM users WHERE id = ? FOR UPDATE", [
      userId,
    ]);
    const [validTokens] = await connection.execute(
      `SELECT id FROM auth_password_reset_tokens
       WHERE token_hash = ? AND user_id = ? AND used_at IS NULL
         AND expires_at > UTC_TIMESTAMP() LIMIT 1 FOR UPDATE`,
      [tokenHash, userId],
    );
    if (!validTokens[0]) {
      await connection.commit();
      return null;
    }

    await connection.execute(
      "UPDATE users SET password_hash = ? WHERE id = ?",
      [passwordHash, userId],
    );
    await connection.execute(
      `UPDATE auth_password_reset_tokens SET used_at = UTC_TIMESTAMP()
       WHERE user_id = ? AND used_at IS NULL`,
      [userId],
    );
    await connection.commit();
    return { email: candidates[0].email, mobile: candidates[0].mobile };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function invalidatePasswordReset(tokenHash) {
  await pool.execute(
    `UPDATE auth_password_reset_tokens SET used_at = UTC_TIMESTAMP()
     WHERE token_hash = ? AND used_at IS NULL`,
    [tokenHash],
  );
}

const authModel = {
  findUserByIdentifier,
  findActiveUserById,
  isUserActive,
  incrementRateLimitCounter,
  createPasswordReset,
  hasValidPasswordReset,
  consumePasswordReset,
  invalidatePasswordReset,
};

export {
  findUserByIdentifier,
  findActiveUserById,
  isUserActive,
  incrementRateLimitCounter,
  createPasswordReset,
  hasValidPasswordReset,
  consumePasswordReset,
  invalidatePasswordReset,
};

export default authModel;
