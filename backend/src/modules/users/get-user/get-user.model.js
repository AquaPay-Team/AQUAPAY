
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
  LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
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

async function findDescendantRoles(actorId) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE descendants AS (
       SELECT rh.child_role_id AS role_id
       FROM users actor
       JOIN role_hierarchy rh ON rh.parent_role_id = actor.role_id
       WHERE actor.id = ? AND actor.status = 'active'
       UNION DISTINCT
       SELECT rh.child_role_id
       FROM role_hierarchy rh
       JOIN descendants d ON rh.parent_role_id = d.role_id
     )
     SELECT DISTINCT r.id, r.name, r.slug
     FROM descendants d
     JOIN roles r ON r.id = d.role_id
     ORDER BY r.id`,
    [actorId],
  );
  return rows;
}

// Helper to build parameterized SQL filter clauses across user queries
function buildUserFilterClauses(options = {}, includeRoleId = true) {
  const conditions = [];
  const params = [];

  if (includeRoleId && options.roleId) {
    conditions.push("u.role_id = ?");
    params.push(options.roleId);
  }

  if (options.status) {
    conditions.push("u.status = ?");
    params.push(String(options.status).toLowerCase());
  }

  if (options.kycStatus) {
    const kyc = String(options.kycStatus).toLowerCase().trim();
    if (kyc === "pending") {
      conditions.push("(k.status = 'pending' OR k.status IS NULL)");
    } else if (kyc === "under_review") {
      conditions.push("k.status IN ('under_review', 'submitted')");
    } else if (kyc === "verified" || kyc === "approved" || kyc === "completed") {
      conditions.push("k.status IN ('approved', 'verified', 'completed')");
    } else if (kyc === "rejected") {
      conditions.push("k.status = 'rejected'");
    } else {
      conditions.push("k.status = ?");
      params.push(options.kycStatus);
    }
  }

  if (options.search) {
    conditions.push(`(
      u.name LIKE ?
      OR u.mobile LIKE ?
      OR u.email LIKE ?
      OR u.shopname LIKE ?
      OR CAST(u.id AS CHAR) LIKE ?
    )`);
    const searchValue = `%${options.search}%`;
    params.push(searchValue, searchValue, searchValue, searchValue, searchValue);
  }

  return { conditions, params };
}

// Get all users (Admin view) with pagination, sorting by newest first
async function findAllUsers(options = {}) {
  const { conditions, params } = buildUserFilterClauses(options, true);
  const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";

  // 1. Total count query
  const countSql = `
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN companies c ON c.id = u.company_id
    LEFT JOIN users p ON p.id = u.parent_id
    LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
    ${whereClause}
  `;
  const [countRows] = await pool.execute(countSql, params);
  const total = Number(countRows[0]?.total || 0);

  // 2. Paginated data query
  const limit = Math.min(Math.max(1, Number(options.limit) || 100), 100);
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;

  const dataSql = `${USER_PROJECTION} ${whereClause} ORDER BY u.created_at DESC, u.id DESC LIMIT ${limit} OFFSET ${offset}`;
  const [rows] = await pool.execute(dataSql, params);

  return {
    users: rows.map(formatUserRow),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Fetches an Admin-only, paginated user directory. The caller is responsible
 * for Admin authorization; this model deliberately reuses the established
 * safe projection and formatter used by the existing user-read APIs.
 */
async function findAdminUsersPage(options = {}) {
  const conditions = [];
  const filterParams = [];

  if (options.userId !== undefined && options.userId !== null) {
    conditions.push("u.id = ?");
    filterParams.push(options.userId);
  } else if (options.nameSearch) {
    conditions.push("u.name LIKE ?");
    filterParams.push(`%${options.nameSearch}%`);
  }

  if (options.status) {
    conditions.push("u.status = ?");
    filterParams.push(options.status);
  }

  if (options.roleId) {
    conditions.push("u.role_id = ?");
    filterParams.push(options.roleId);
  }

  if (options.registeredFrom) {
    conditions.push("u.created_at >= ?");
    filterParams.push(options.registeredFrom);
  }

  if (options.registeredTo) {
    conditions.push("u.created_at < ?");
    filterParams.push(options.registeredTo);
  }

  const whereClause = conditions.length
    ? ` WHERE ${conditions.join(" AND ")}`
    : "";

  const [countRows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM users u${whereClause}`,
    filterParams,
  );

  const offset = (options.page - 1) * options.limit;
  const [rows] = await pool.execute(
    `${USER_PROJECTION}${whereClause}
     ORDER BY u.created_at DESC, u.id DESC
     LIMIT ? OFFSET ?`,
    [...filterParams, options.limit, offset],
  );

  return {
    users: rows.map(formatUserRow),
    total: Number(countRows[0]?.total || 0),
  };
}

async function findUsersInDescendantScope(actorId, roleId, options = {}) {
  const { conditions, params: filterParams } = buildUserFilterClauses(options, false);
  const allConditions = ["u.role_id = ?", "scope.id <> ?", ...conditions];
  const allParams = [actorId, roleId, actorId, ...filterParams];

  // 1. Total count query
  const countSql = `
    WITH RECURSIVE scope AS (
      SELECT id FROM users WHERE id = ?
      UNION DISTINCT
      SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
    )
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN companies c ON c.id = u.company_id
    LEFT JOIN users p ON p.id = u.parent_id
    LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
    JOIN scope ON scope.id = u.id
    WHERE ${allConditions.join(" AND ")}
  `;
  const [countRows] = await pool.execute(countSql, allParams);
  const total = Number(countRows[0]?.total || 0);

  // 2. Paginated data query
  const limit = Math.min(Math.max(1, Number(options.limit) || 100), 100);
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;

  const dataSql = `
    WITH RECURSIVE scope AS (
      SELECT id FROM users WHERE id = ?
      UNION DISTINCT
      SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
    )
    ${USER_PROJECTION}
    JOIN scope ON scope.id = u.id
    WHERE ${allConditions.join(" AND ")}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute(dataSql, allParams);

  return {
    users: rows.map(formatUserRow),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
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

// Get children created by a parent with optional KYC status, search, and pagination.
async function findChildrenByParentId(parentId, options = {}) {
  const { conditions, params: filterParams } = buildUserFilterClauses(options, true);
  const allConditions = ["scope.id <> ?", ...conditions];
  const allParams = [parentId, parentId, ...filterParams];

  // 1. Total count query
  const countSql = `
    WITH RECURSIVE scope AS (
      SELECT id FROM users WHERE id = ?
      UNION DISTINCT
      SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
    )
    SELECT COUNT(DISTINCT u.id) AS total
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN companies c ON c.id = u.company_id
    LEFT JOIN users p ON p.id = u.parent_id
    LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
    JOIN scope ON scope.id = u.id
    WHERE ${allConditions.join(" AND ")}
  `;
  const [countRows] = await pool.execute(countSql, allParams);
  const total = Number(countRows[0]?.total || 0);

  // 2. Paginated data query
  const limit = Math.min(Math.max(1, Number(options.limit) || 100), 100);
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * limit;

  const dataSql = `
    WITH RECURSIVE scope AS (
      SELECT id FROM users WHERE id = ?
      UNION DISTINCT
      SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
    )
    ${USER_PROJECTION}
    JOIN scope ON scope.id = u.id
    WHERE ${allConditions.join(" AND ")}
    ORDER BY u.created_at DESC, u.id DESC
    LIMIT ${limit} OFFSET ${offset}
  `;
  const [rows] = await pool.execute(dataSql, allParams);

  return {
    users: rows.map(formatUserRow),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      hasNextPage: page * limit < total,
      hasPreviousPage: page > 1,
    },
  };
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

async function findDescendantUserById(childId, parentId) {
  const [rows] = await pool.execute(
    `WITH RECURSIVE scope AS (
       SELECT id FROM users WHERE id = ?
       UNION DISTINCT
       SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
     )
     ${USER_PROJECTION}
     JOIN scope ON scope.id = u.id
     WHERE u.id = ? AND u.id <> ?
     LIMIT 1`,
    [parentId, childId, parentId],
  );
  return formatUserRow(rows[0]);
}

async function getUserStats(actorId, isAdminActor) {
  if (isAdminActor) {
    const sql = `
      SELECT
        COUNT(DISTINCT u.id) AS total,
        COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) AS active,
        COUNT(DISTINCT CASE WHEN r.slug = 'RT' OR r.id = 8 THEN u.id END) AS retailers,
        COUNT(DISTINCT CASE WHEN r.slug = 'DT' OR r.id = 7 THEN u.id END) AS distributors,
        COUNT(DISTINCT CASE WHEN k.status IN ('approved', 'verified', 'completed') THEN u.id END) AS verifiedKyc,
        COUNT(DISTINCT CASE WHEN k.status = 'pending' OR k.status IS NULL THEN u.id END) AS pendingKyc
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
    `;
    const [rows] = await pool.execute(sql);
    const row = rows[0] || {};
    return {
      total: Number(row.total || 0),
      active: Number(row.active || 0),
      retailers: Number(row.retailers || 0),
      distributors: Number(row.distributors || 0),
      verifiedKyc: Number(row.verifiedKyc || 0),
      pendingKyc: Number(row.pendingKyc || 0),
    };
  }

  const sql = `
    WITH RECURSIVE scope AS (
      SELECT id FROM users WHERE id = ?
      UNION DISTINCT
      SELECT child.id FROM users child JOIN scope parent ON child.parent_id = parent.id
    )
    SELECT
      COUNT(DISTINCT u.id) AS total,
      COUNT(DISTINCT CASE WHEN u.status = 'active' THEN u.id END) AS active,
      COUNT(DISTINCT CASE WHEN r.slug = 'RT' OR r.id = 8 THEN u.id END) AS retailers,
      COUNT(DISTINCT CASE WHEN r.slug = 'DT' OR r.id = 7 THEN u.id END) AS distributors,
      COUNT(DISTINCT CASE WHEN k.status IN ('approved', 'verified', 'completed') THEN u.id END) AS verifiedKyc,
      COUNT(DISTINCT CASE WHEN k.status = 'pending' OR k.status IS NULL THEN u.id END) AS pendingKyc
    FROM users u
    JOIN roles r ON r.id = u.role_id
    LEFT JOIN kyc_cases k ON k.id = (SELECT MAX(k2.id) FROM kyc_cases k2 WHERE k2.user_id = u.id)
    JOIN scope ON scope.id = u.id
    WHERE scope.id <> ?
  `;
  const [rows] = await pool.execute(sql, [actorId, actorId]);
  const row = rows[0] || {};
  return {
    total: Number(row.total || 0),
    active: Number(row.active || 0),
    retailers: Number(row.retailers || 0),
    distributors: Number(row.distributors || 0),
    verifiedKyc: Number(row.verifiedKyc || 0),
    pendingKyc: Number(row.pendingKyc || 0),
  };
}

export {
  findActorRole,
  findDescendantRoles,
  findUsersInDescendantScope,
  findAllUsers,
  findAdminUsersPage,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findDescendantUserById,
  getUserStats,
  formatUserRow,
};

export default {
  findActorRole,
  findDescendantRoles,
  findUsersInDescendantScope,
  findAllUsers,
  findAdminUsersPage,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findDescendantUserById,
  getUserStats,
  formatUserRow,
};
