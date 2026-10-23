import pool from "../../../config/db.js";

const USER_PROJECTION = `
  SELECT
    u.id,
    u.name,
    u.email,
    u.mobile,
    u.shopname,
    u.address,
    u.state,
    u.city,
    u.pincode,
    u.status,
    u.role_id,
    r.name AS role_name,
    r.slug AS role_slug,
    u.company_id,
    c.name AS company_name,
    u.parent_id,
    p.name AS parent_name,
    u.created_at,
    u.updated_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN users p ON p.id = u.parent_id
`;

// Retrieve caller role to determine admin privileges
async function findActorRole(actorId) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.role_id, r.slug AS role_slug
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [actorId],
  );
  return rows[0] || null;
}

// Get all users (Admin view)
async function findAllUsers() {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     ORDER BY u.id DESC`,
  );
  return rows;
}

// Get single user by ID (Admin view)
async function findUserById(userId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

// Get all children created by a parent (Non-admin view)
async function findChildrenByParentId(parentId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.parent_id = ?
     ORDER BY u.id DESC`,
    [parentId],
  );
  return rows;
}

// Get a single child created by a parent (Non-admin view)
async function findChildByIdAndParentId(childId, parentId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ? AND u.parent_id = ?
     LIMIT 1`,
    [childId, parentId],
  );
  return rows[0] || null;
}

export {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
};

export default {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
};