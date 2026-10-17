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
    createdBy,
    status = "active",
  },
  connection,
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
        status,
      ],
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
      status,
    ],
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
    [userId],
  );
  return rows[0] || null;
}

async function isInDownline(
  actorId,
  targetUserId,
  isAdmin = false,
  connection,
) {
  const actor = Number(actorId);
  const target = Number(targetUserId);

  if (
    !Number.isSafeInteger(actor) ||
    actor <= 0 ||
    !Number.isSafeInteger(target) ||
    target <= 0
  ) {
    return false;
  }

  // A user can access their own record.
  if (actor === target) {
    return true;
  }

  // Admin has unrestricted user access under the current policy.
  if (isAdmin) {
    return true;
  }

  const [rows] = await getDb(connection).execute(
    `WITH RECURSIVE downline AS (
       SELECT id, parent_id
       FROM users
       WHERE id = ?

       UNION ALL

       SELECT u.id, u.parent_id
       FROM users u
       INNER JOIN downline d ON u.parent_id = d.id
     )
     SELECT 1
     FROM downline
     WHERE id = ? AND id <> ?
     LIMIT 1`,
    [actor, target, actor],
  );

  return rows.length > 0;
}

async function listUsersDownline(
  {
    actorId,
    isAdmin = false,
    scope = "all",
    roleId = null,
    status = null,
    search = null,
    limit = 20,
    offset = 0,
  },
  connection,
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

  const whereSql =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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
    params,
  );
  return result.affectedRows;
}

async function updateUserStatus(userId, status, connection) {
  const [result] = await getDb(connection).execute(
    `UPDATE users SET status = ? WHERE id = ?`,
    [status, userId],
  );
  return result.affectedRows;
}

async function deleteUser(userId, connection) {
  const [result] = await getDb(connection).execute(
    `DELETE FROM users WHERE id = ?`,
    [userId],
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
  deleteUser,
};
