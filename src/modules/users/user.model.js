import defaultPool from "../../config/db.js";

const getDb = (connection) => connection || defaultPool;

async function findUserForAuth(userId, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.company_id, u.role_id, u.status,
            r.name AS role_name, r.slug AS role_slug,
            c.name AS company_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = ? AND u.status = 'active'
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

async function findRoleByIdOrName(roleInput, connection) {
  if (roleInput === undefined || roleInput === null) {
    return null;
  }

  const input = String(roleInput).trim();

  if (!input) {
    return null;
  }

  const db = getDb(connection);

  // Numeric input is treated as a role ID.
  if (/^\d+$/.test(input) && Number(input) > 0) {
    const [rows] = await db.execute(
      `SELECT id, name, slug
       FROM roles
       WHERE id = ?
       LIMIT 1`,
      [Number(input)],
    );

    return rows[0] || null;
  }

  // Non-numeric input can match either role name or slug.
  const [rows] = await db.execute(
    `SELECT id, name, slug
     FROM roles
     WHERE LOWER(name) = LOWER(?)
        OR LOWER(slug) = LOWER(?)
     LIMIT 1`,
    [input, input],
  );

  return rows[0] || null;
}

async function checkRoleHierarchy(parentRoleId, childRoleId, connection) {
  const db = getDb(connection);

  // A role cannot create another user with the same role.
  if (Number(parentRoleId) === Number(childRoleId)) {
    return false;
  }

  const [rows] = await db.execute(
    `
    WITH RECURSIVE descendants AS (
      SELECT child_role_id
      FROM role_hierarchy
      WHERE parent_role_id = ?

      UNION DISTINCT

      SELECT rh.child_role_id
      FROM role_hierarchy rh
      INNER JOIN descendants d
        ON rh.parent_role_id = d.child_role_id
    )
    SELECT 1
    FROM descendants
    WHERE child_role_id = ?
    LIMIT 1
    `,
    [parentRoleId, childRoleId],
  );

  return rows.length > 0;
}

async function checkDuplicateUser(
  { email, mobile, excludeUserId },
  connection,
) {
  let sql = `SELECT id, email, mobile FROM users WHERE (email = ? OR mobile = ?)`;
  const params = [email, mobile];

  if (excludeUserId) {
    sql += ` AND id <> ?`;
    params.push(excludeUserId);
  }
  sql += ` LIMIT 1`;

  const [rows] = await getDb(connection).execute(sql, params);
  return rows[0] || null;
}

async function insertUser(
  {
    name,
    email,
    mobile,
    state,
    city,
    passwordHash,
    roleId,
    companyId,
    parentId,
    status = "active",
  },
  connection,
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO users (name, email, mobile, state, city, password_hash, role_id, company_id, parent_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      mobile,
      state || null,
      city || null,
      passwordHash,
      roleId,
      companyId || null,
      parentId || null,
      status,
    ],
  );
  return result.insertId;
}

async function findUserSafeById(userId, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.state, u.city, u.role_id, u.company_id, u.parent_id, u.status, u.created_at,
            r.name AS role_name, r.slug AS role_slug,
            p.name AS parent_name,
            c.name AS company_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN users p ON p.id = u.parent_id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  return rows[0] || null;
}

const userModel = {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  findUserSafeById,
};

export {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  findUserSafeById,
};

export default userModel;

