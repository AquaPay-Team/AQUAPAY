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

    u.scheme_id,
    s.id AS scheme_record_id,
    s.name AS scheme_name,
    s.status AS scheme_status,
    s.created_at AS scheme_created_at,

    k.id AS kyc_case_id,
    k.status AS kyc_status,
    k.steps_completed AS kyc_steps_completed,
    k.business_type AS kyc_business_type,

    u.created_at,
    u.updated_at

  FROM users u

  JOIN roles r
    ON r.id = u.role_id

  LEFT JOIN companies c
    ON c.id = u.company_id

  LEFT JOIN users p
    ON p.id = u.parent_id

  LEFT JOIN schemes s
    ON s.id = u.scheme_id

  LEFT JOIN kyc_cases k
    ON k.user_id = u.id
`;

function formatUserRow(row) {
  if (!row) return null;

  const user = { ...row };

  // Remove temporary KYC query fields.
  delete user.kyc_case_id;
  delete user.kyc_status;
  delete user.kyc_steps_completed;
  delete user.kyc_business_type;

  // Remove temporary scheme query fields.
  delete user.scheme_record_id;
  delete user.scheme_name;
  delete user.scheme_status;
  delete user.scheme_created_at;

  // Preserve existing KYC response format.
  user.kyc = row.kyc_case_id
    ? {
        status: row.kyc_status,
        steps_completed: row.kyc_steps_completed,
        business_type: row.kyc_business_type,
      }
    : null;

  // Add nested scheme information.
  user.scheme =
    row.scheme_record_id == null
      ? null
      : {
          id: row.scheme_record_id,
          name: row.scheme_name,
          status: String(row.scheme_status),
          created_at: row.scheme_created_at,
        };

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

async function findDescendantRoles(actorId) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE descendants AS (
       SELECT rh.child_role_id AS role_id
       FROM users actor
       JOIN role_hierarchy rh
         ON rh.parent_role_id = actor.role_id
       WHERE actor.id = ?
         AND actor.status = 'active'

       UNION DISTINCT

       SELECT rh.child_role_id
       FROM role_hierarchy rh
       JOIN descendants d
         ON rh.parent_role_id = d.role_id
     )

     SELECT DISTINCT
       r.id,
       r.name,
       r.slug

     FROM descendants d
     JOIN roles r
       ON r.id = d.role_id

     ORDER BY r.id`,
    [actorId],
  );

  return rows;
}

// Get all users (Admin view) with optional filters.
async function findAllUsers(options = {}) {
  let query = USER_PROJECTION;

  const conditions = [];
  const params = [];

  if (options.kycStatus) {
    conditions.push(`k.status = ?`);
    params.push(options.kycStatus);
  }

  if (options.roleId) {
    conditions.push(`u.role_id = ?`);
    params.push(options.roleId);
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

// Get users within the authorized descendant hierarchy.
async function findUsersInDescendantScope(
  actorId,
  roleId,
  options = {},
) {
  const conditions = [
    "u.role_id = ?",
    "scope.id <> ?",
  ];

  const params = [actorId, roleId, actorId];

  if (options.kycStatus) {
    conditions.push("k.status = ?");
    params.push(options.kycStatus);
  }

  if (options.search) {
    conditions.push(
      `(u.name LIKE ? OR u.mobile LIKE ? OR u.email LIKE ?)`,
    );

    const value = `%${options.search}%`;

    params.push(value, value, value);
  }

  const [rows] = await pool.execute(
    `WITH RECURSIVE scope AS (
       SELECT id
       FROM users
       WHERE id = ?

       UNION DISTINCT

       SELECT child.id
       FROM users child
       JOIN scope parent
         ON child.parent_id = parent.id
     )

     ${USER_PROJECTION}

     JOIN scope
       ON scope.id = u.id

     WHERE ${conditions.join(" AND ")}

     ORDER BY u.id DESC`,
    params,
  );

  return rows.map(formatUserRow);
}

// Get one user by ID.
async function findUserById(userId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  return formatUserRow(rows[0]);
}

// Get users created by a specific parent.
async function findChildrenByParentId(
  parentId,
  options = {},
) {
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

// Find a direct child by ID and parent.
async function findChildByIdAndParentId(
  childId,
  parentId,
) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ?
       AND u.parent_id = ?
     LIMIT 1`,
    [childId, parentId],
  );

  return formatUserRow(rows[0]);
}

// Find a user within the actual descendant hierarchy.
async function findDescendantUserById(
  childId,
  parentId,
) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE scope AS (
       SELECT id
       FROM users
       WHERE id = ?

       UNION DISTINCT

       SELECT child.id
       FROM users child
       JOIN scope parent
         ON child.parent_id = parent.id
     )

     ${USER_PROJECTION}

     JOIN scope
       ON scope.id = u.id

     WHERE u.id = ?
       AND u.id <> ?

     LIMIT 1`,
    [parentId, childId, parentId],
  );

  return formatUserRow(rows[0]);
}

export {
  findActorRole,
  findDescendantRoles,
  findUsersInDescendantScope,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findDescendantUserById,
  formatUserRow,
};

export default {
  findActorRole,
  findDescendantRoles,
  findUsersInDescendantScope,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findDescendantUserById,
  formatUserRow,
};
