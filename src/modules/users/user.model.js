const defaultPool = require("../../config/db");

const getDb = (connection) => connection || defaultPool;

async function findUserForAuth(userId, connection) {
    const [rows] = await getDb(connection).execute(
        `SELECT u.id, u.name, u.email, u.company_id, u.role_id, u.status,
                r.name AS role_name,
                c.name AS company_name
         FROM users u
         JOIN roles r ON r.id = u.role_id
         LEFT JOIN companies c ON c.id = u.company_id
         WHERE u.id = ? AND u.status = 'active'
         LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
}

async function findRoleByIdOrName(roleInput, connection) {
    if (roleInput === undefined || roleInput === null) {
        return null;
    }

    const value = String(roleInput).trim();

    if (!value) {
        return null;
    }

    if (/^\d+$/.test(value)) {
        const id = Number(value);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return null;
        }

        const [rows] = await getDb(connection).execute(
            `SELECT id, name, slug
             FROM roles
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return rows[0] || null;
    }

    const [rows] = await getDb(connection).execute(
        `SELECT id, name, slug
         FROM roles
         WHERE LOWER(name) = LOWER(?)
            OR LOWER(slug) = LOWER(?)
         LIMIT 1`,
        [value, value]
    );

    return rows[0] || null;
}


async function checkRoleHierarchy(parentRoleId, childRoleId, connection) {
    const [rows] = await getDb(connection).execute(
        `SELECT 1
         FROM role_hierarchy
         WHERE parent_role_id = ?
           AND child_role_id = ?
         LIMIT 1`,
        [parentRoleId, childRoleId]
    );

    return rows.length > 0;
}


async function checkDuplicateUser({ email, mobile }, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT id, email, mobile FROM users WHERE email = ? OR mobile = ? LIMIT 1`,
    [email, mobile]
  );
  return rows[0] || null;
}

async function insertUser(
  { name, email, mobile, passwordHash, roleId, companyId, parentId, status = "active" },
  connection
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO users (name, email, mobile, password_hash, role_id, company_id, parent_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      mobile,
      passwordHash,
      roleId,
      companyId || null,
      parentId || null,
      status
    ]
  );
  return result.insertId;
}


async function findUserSafeById(userId, connection) {
    const [rows] = await getDb(connection).execute(
        `SELECT u.id, u.name, u.email, u.mobile,
                u.role_id, u.company_id, u.parent_id,
                u.status, u.created_at,
                r.name AS role_name, r.slug AS role_slug
         FROM users u
         JOIN roles r ON r.id = u.role_id
         WHERE u.id = ?
         LIMIT 1`,
        [userId]
    );

    return rows[0] || null;
}

module.exports = {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  findUserSafeById
};
