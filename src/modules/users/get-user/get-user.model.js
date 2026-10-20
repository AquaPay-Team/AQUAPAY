import pool from "../../../config/db.js";

// Get all children created by a parent
async function findChildrenByParentId(parentId) {
  const [rows] = await pool.execute(
    `SELECT
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
     WHERE u.parent_id = ?
     ORDER BY u.id DESC`,
    [parentId],
  );

  return rows;
}

// Get a single child created by a parent
async function findChildByIdAndParentId(childId, parentId) {
  const [rows] = await pool.execute(
    `SELECT
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
     WHERE u.id = ? AND u.parent_id = ?
     LIMIT 1`,
    [childId, parentId],
  );

  return rows[0] || null;
}

export {
  findChildrenByParentId,
  findChildByIdAndParentId,
};

export default {
  findChildrenByParentId,
  findChildByIdAndParentId,
};