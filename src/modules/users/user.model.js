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
  if (roleInput === undefined || roleInput === null) {
    return null;
  }

  const isNumeric = !isNaN(Number(roleInput)) && Number(roleInput) > 0;
  if (isNumeric) {
    const [rows] = await getDb(connection).execute(
      `SELECT id, name, level FROM roles WHERE id = ? LIMIT 1`,
      [Number(roleInput)]
    );
    return rows[0] || null;
  }

  const roleName = String(roleInput).trim();
  if (!roleName) return null;

  const [rows] = await getDb(connection).execute(
    `SELECT id, name, level FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1`,
    [roleName]
  );
  return rows[0] || null;
}

async function checkRoleHierarchy(parentRoleId, childRoleId, connection) {
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

  // Any parent role can create any role strictly down in their hierarchy (child.level > parent.level)
  return child.level > parent.level;
}

async function checkDuplicateUser({ email, mobile, excludeUserId }, connection) {
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
  { name, email, mobile, state, city, passwordHash, roleId, companyId, parentId, createdBy, status = "active" },
  connection
) {
  if (createdBy !== undefined && createdBy !== null) {
    const [result] = await getDb(connection).execute(
      `INSERT INTO users (name, email, mobile, state, city, password_hash, role_id, company_id, parent_id, created_by, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        createdBy,
        status
      ]
    );
    return result.insertId;
  }

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
      status
    ]
  );
  return result.insertId;
}

async function findUserSafeById(userId, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.state, u.city, u.role_id, u.company_id, u.parent_id, u.created_by, u.status, u.created_at,
            r.name AS role_name, r.level AS role_level,
            p.name AS parent_name,
            c.company_name
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN users p ON p.id = u.parent_id
     LEFT JOIN companies c ON c.id = u.company_id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

async function isInDownline(actorId, targetUserId, isAdmin = false, connection) {
  if (actorId === targetUserId) return true;
  if (isAdmin) return true;

  const [rows] = await getDb(connection).execute(
    `WITH RECURSIVE downline AS (
       SELECT id, parent_id, created_by FROM users WHERE id = ?
       UNION ALL
       SELECT u.id, u.parent_id, u.created_by FROM users u
       JOIN downline d ON (u.parent_id = d.id OR u.created_by = d.id)
     )
     SELECT 1 FROM downline WHERE id = ? AND id <> ? LIMIT 1`,
    [actorId, targetUserId, actorId]
  );
  return rows.length > 0;
}

async function listUsersDownline(
  { actorId, isAdmin = false, scope = "all", roleId = null, status = null, search = null, limit = 20, offset = 0 },
  connection
) {
  const conditions = [];
  const params = [];

  let fromClause = "";

  if (isAdmin && scope !== "direct") {
    fromClause = `FROM users u`;
    conditions.push(`u.id <> ?`);
    params.push(actorId);
  } else if (scope === "direct") {
    fromClause = `FROM users u`;
    conditions.push(`(u.parent_id = ? OR u.created_by = ?)`);
    params.push(actorId, actorId);
  } else {
    fromClause = `FROM (
      WITH RECURSIVE downline AS (
        SELECT id, parent_id, created_by FROM users WHERE id = ?
        UNION ALL
        SELECT u.id, u.parent_id, u.created_by FROM users u
        JOIN downline d ON (u.parent_id = d.id OR u.created_by = d.id)
      )
      SELECT id FROM downline WHERE id <> ?
    ) dl JOIN users u ON u.id = dl.id`;
    params.push(actorId, actorId);
  }

  if (roleId) {
    conditions.push(`u.role_id = ?`);
    params.push(roleId);
  }

  if (status) {
    conditions.push(`u.status = ?`);
    params.push(status);
  }

  if (search) {
    conditions.push(`(u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`);
    const searchParam = `%${search}%`;
    params.push(searchParam, searchParam, searchParam);
  }

  const whereSql = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countSql = `SELECT COUNT(*) AS total ${fromClause} ${whereSql}`;
  const [countRows] = await getDb(connection).execute(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  const querySql = `
    SELECT u.id, u.name, u.email, u.mobile, u.state, u.city, u.role_id, u.company_id, u.parent_id, u.created_by, u.status, u.created_at,
           r.name AS role_name, r.level AS role_level,
           p.name AS parent_name
    ${fromClause}
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN users p ON p.id = u.parent_id
    ${whereSql}
    ORDER BY u.id DESC
    LIMIT ? OFFSET ?
  `;

  const queryParams = [...params, Number(limit), Number(offset)];
  const [rows] = await getDb(connection).query(querySql, queryParams);

  return { rows, total };
}

async function updateUser(userId, { name, mobile, state, city }, connection) {
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push("name = ?");
    params.push(name);
  }
  if (mobile !== undefined) {
    updates.push("mobile = ?");
    params.push(mobile);
  }
  if (state !== undefined) {
    updates.push("state = ?");
    params.push(state);
  }
  if (city !== undefined) {
    updates.push("city = ?");
    params.push(city);
  }

  if (updates.length === 0) return 0;

  params.push(userId);
  const [result] = await getDb(connection).execute(
    `UPDATE users SET ${updates.join(", ")} WHERE id = ?`,
    params
  );
  return result.affectedRows;
}

async function updateUserStatus(userId, status, connection) {
  const [result] = await getDb(connection).execute(
    `UPDATE users SET status = ? WHERE id = ?`,
    [status, userId]
  );
  return result.affectedRows;
}

async function deleteUser(userId, connection) {
  const [result] = await getDb(connection).execute(
    `DELETE FROM users WHERE id = ?`,
    [userId]
  );
  return result.affectedRows;
}

module.exports = {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  findUserSafeById,
  isInDownline,
  listUsersDownline,
  updateUser,
  updateUserStatus,
  deleteUser
};
