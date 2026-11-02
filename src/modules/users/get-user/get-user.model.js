
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
    k.id AS kyc_case_id,
    k.status AS kyc_status,
    k.steps_completed AS kyc_steps_completed,
    k.business_type AS kyc_business_type,
    u.created_at,
    u.updated_at
  FROM users u
  JOIN roles r ON r.id = u.role_id
  LEFT JOIN companies c ON c.id = u.company_id
  LEFT JOIN users p ON p.id = u.parent_id
  LEFT JOIN kyc_cases k ON k.user_id = u.id
`;

function formatUserRow(row) {
  if (!row) return null;

  const user = { ...row };

  delete user.kyc_case_id;
  delete user.kyc_status;
  delete user.kyc_steps_completed;
  delete user.kyc_business_type;

  user.kyc = row.kyc_case_id
    ? {
        status: row.kyc_status,
        steps_completed: row.kyc_steps_completed,
        business_type: row.kyc_business_type,
      }
    : null;

  return user;
}

// Retrieve caller role to determine admin privileges.
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

// Get all users (Admin view) with optional KYC status filter.
// Get all users (Admin view) with optional KYC status and search filters.
async function findAllUsers(options = {}) {
  let query = USER_PROJECTION;
  const conditions = [];
  const params = [];

  if (options.kycStatus) {
    conditions.push(`k.status = ?`);
    params.push(options.kycStatus);
  }

  if (options.search) {
    conditions.push(`(
      u.name LIKE ?
      OR u.mobile LIKE ?
      OR u.email LIKE ?
    )`);

    const searchValue = `%${options.search}%`;

    params.push(searchValue, searchValue, searchValue);
  }

  if (conditions.length > 0) {
    query += ` WHERE ${conditions.join(" AND ")}`;
  }

  query += ` ORDER BY u.id DESC`;

  const [rows] = await pool.execute(query, params);
  return rows.map(formatUserRow);
}

async function findUserById(userId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  return formatUserRow(rows[0]);
}

// Get children created by a parent.

// Get children created by a parent with optional KYC status and search filters.
async function findChildrenByParentId(parentId, options = {}) {
  let query = `${USER_PROJECTION}
    WHERE u.parent_id = ?`;

  const params = [parentId];

  if (options.kycStatus) {
    query += ` AND k.status = ?`;
    params.push(options.kycStatus);
  }

  if (options.search) {
    query += ` AND (
      u.name LIKE ?
      OR u.mobile LIKE ?
      OR u.email LIKE ?
    )`;

    const searchValue = `%${options.search}%`;

    params.push(searchValue, searchValue, searchValue);
  }

  query += ` ORDER BY u.id DESC`;

  const [rows] = await pool.execute(query, params);
  return rows.map(formatUserRow);
}


async function findChildByIdAndParentId(childId, parentId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ? AND u.parent_id = ?
     LIMIT 1`,
    [childId, parentId],
  );

  return formatUserRow(rows[0]);
}

export {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  formatUserRow,
};

export default {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  formatUserRow,
};
