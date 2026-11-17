import pool from "../../../config/db.js";

async function getConnection() {
  return pool.getConnection();
}

async function findActiveUserForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    "SELECT id, role_id, status FROM users WHERE id = ? AND status = 'active' LIMIT 1 FOR UPDATE",
    [userId],
  );
  return rows[0] || null;
}

async function findTargetForUpdate(connection, userId) {
  const [rows] = await connection.execute(
    `SELECT id, role_id, parent_id, status
       FROM users WHERE id = ? LIMIT 1 FOR UPDATE`,
    [userId],
  );
  return rows[0] || null;
}

async function isDescendant(connection, actorId, targetId) {
  const [rows] = await connection.execute(
    `WITH RECURSIVE descendants AS (
       SELECT id FROM users WHERE parent_id = ?
       UNION DISTINCT
       SELECT child.id FROM users child
       JOIN descendants parent ON child.parent_id = parent.id
     )
     SELECT 1 AS permitted FROM descendants WHERE id = ? LIMIT 1`,
    [actorId, targetId],
  );
  return rows.length > 0;
}

async function updatePasswordHash(connection, userId, passwordHash) {
  const [result] = await connection.execute(
    "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [passwordHash, userId],
  );
  return Number(result.affectedRows) === 1;
}

export default { getConnection, findActiveUserForUpdate, findTargetForUpdate, isDescendant, updatePasswordHash };
