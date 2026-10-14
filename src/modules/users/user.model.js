const defaultPool = require("../../config/db");

const getDb = (connection) => connection || defaultPool;

async function findUserForAuth(userId, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.company_id, u.role_id, u.status,
            r.name AS role_name, r.level AS role_level,
            c.company_name, c.status AS company_status
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
  const isNumeric = !isNaN(Number(roleInput)) && Number(roleInput) > 0;
  if (isNumeric) {
    const [rows] = await getDb(connection).execute(
      `SELECT id, name, level FROM roles WHERE id = ? LIMIT 1`,
      [Number(roleInput)]
    );
    return rows[0] || null;
  }

  const roleName = String(roleInput).trim();
  const [rows] = await getDb(connection).execute(
    `SELECT id, name, level FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [roleName]
  );
  return rows[0] || null;
}

async function checkRoleHierarchy(parentRoleId, childRoleId, connection) {
  try {
    const [rows] = await getDb(connection).execute(
      `SELECT 1 FROM role_hierarchy WHERE parent_role_id = ? AND child_role_id = ? LIMIT 1`,
      [parentRoleId, childRoleId]
    );
    if (rows.length > 0) {
      return true;
    }
  } catch (err) {
    // If role_hierarchy table is not populated or queried, use agreed role level hierarchy
  }

  // Fetch parent and child role details (name and level)
  const [parentRoles] = await getDb(connection).execute(
    `SELECT id, name, level FROM roles WHERE id = ? LIMIT 1`,
    [parentRoleId]
  );
  const [childRoles] = await getDb(connection).execute(
    `SELECT id, name, level FROM roles WHERE id = ? LIMIT 1`,
    [childRoleId]
  );

  if (!parentRoles.length || !childRoles.length) {
    return false;
  }

  const parent = parentRoles[0];
  const child = childRoles[0];
  const parentName = String(parent.name).trim().toLowerCase();

  // Admin can create any subordinate user
  if (parentName === "admin" || parent.level === 0 || (parent.level === 1 && parentName === "admin")) {
    return child.level > parent.level;
  }
  return child.level === parent.level + 1;
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
    `SELECT u.id, u.name, u.email, u.mobile, u.role_id, u.company_id, u.parent_id, u.status, u.created_at,
            r.name AS role_name, r.level AS role_level
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
