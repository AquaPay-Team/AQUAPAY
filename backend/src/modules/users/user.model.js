
import defaultPool from "../../config/db.js";
import { normalizeMobile } from "../../utils/validationHelper.js";

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
  const normalizedMobile = mobile ? normalizeMobile(mobile) : mobile;

  let sql = `
    SELECT id, email, mobile
    FROM users
    WHERE (email = ? OR mobile = ?)
  `;

  const params = [email, normalizedMobile];

  if (excludeUserId) {
    sql += ` AND id <> ?`;
    params.push(excludeUserId);
  }

  sql += ` LIMIT 1`;

  const [rows] = await getDb(connection).execute(sql, params);

  return rows[0] || null;
}

// Find the currently active Default Scheme.
async function findActiveDefaultScheme(connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT id, name
     FROM schemes
     WHERE is_default = 1
       AND status = 1
     LIMIT 1`,
  );

  return rows[0] || null;
}

// Create a new user and save the assigned scheme_id.
async function insertUser(
  {
    name,
    email,
    mobile,
    shopname,
    address,
    state,
    city,
    pincode,
    passwordHash,
    roleId,
    companyId,
    parentId,
    schemeId,
    status = "active",
  },
  connection,
) {
  const normalizedMobile = mobile ? normalizeMobile(mobile) : mobile;

  const [result] = await getDb(connection).execute(
    `INSERT INTO users (
      name,
      email,
      mobile,
      shopname,
      address,
      state,
      city,
      pincode,
      password_hash,
      role_id,
      company_id,
      parent_id,
      scheme_id,
      status
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      normalizedMobile,
      shopname || null,
      address || null,
      state || null,
      city || null,
      pincode || null,
      passwordHash,
      roleId,
      companyId || null,
      parentId || null,
      schemeId,
      status,
    ],
  );

  return result.insertId;
}

// Record an auditable history of scheme assignments.
async function insertSchemeAssignmentHistory(
  {
    userId,
    previousSchemeId = null,
    newSchemeId,
    actorUserId,
    changeSource,
    reason = null,
  },
  connection,
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO user_scheme_assignments (
      user_id,
      previous_scheme_id,
      new_scheme_id,
      actor_user_id,
      change_source,
      reason
    )
    VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      previousSchemeId,
      newSchemeId,
      actorUserId,
      changeSource,
      reason,
    ],
  );

  return result.insertId;
}

async function updateUserFields(userId, fields, connection) {
  const allowedFields = [
    "name",
    "email",
    "mobile",
    "shopname",
    "address",
    "state",
    "city",
    "pincode",
  ];

  const entries = Object.entries(fields);

  if (entries.length === 0) {
    return false;
  }

  const invalidFields = entries
    .map(([field]) => field)
    .filter((field) => !allowedFields.includes(field));

  if (invalidFields.length > 0) {
    throw new Error(
      `Unsupported user update fields: ${invalidFields.join(", ")}`,
    );
  }

  const setClause = entries
    .map(([field]) => `\`${field}\` = ?`)
    .join(", ");

  const values = entries.map(([, value]) => value);

  const [result] = await getDb(connection).execute(
    `UPDATE users SET ${setClause} WHERE id = ?`,
    [...values, userId],
  );

  return result.affectedRows > 0;
}

// Fetch a user safely, including their assigned scheme.
// Password material is deliberately excluded.
async function findUserSafeById(userId, connection) {
  const [rows] = await getDb(connection).execute(
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
        u.role_id,
        u.company_id,
        u.parent_id,
        u.scheme_id,
        u.status,
        u.created_at,
        u.updated_at,

        r.name AS role_name,
        r.slug AS role_slug,

        p.name AS parent_name,
        c.name AS company_name,

        s.id AS scheme_record_id,
        s.name AS scheme_name,
        s.status AS scheme_status,
        s.created_at AS scheme_created_at

     FROM users u

     JOIN roles r
       ON r.id = u.role_id

     LEFT JOIN users p
       ON p.id = u.parent_id

     LEFT JOIN companies c
       ON c.id = u.company_id

     LEFT JOIN schemes s
       ON s.id = u.scheme_id

     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  const user = rows[0];

  if (!user) {
    return null;
  }

  const {
    scheme_record_id,
    scheme_name,
    scheme_status,
    scheme_created_at,
    ...userData
  } = user;

  return {
    ...userData,

    scheme:
      scheme_record_id == null
        ? null
        : {
            id: scheme_record_id,
            name: scheme_name,
            status: String(scheme_status),
            created_at: scheme_created_at,
          },
  };
}

// Initialize the existing seven-step KYC process.
async function initKycCaseForUser({ userId, actorId }, connection) {
  const db = getDb(connection);

  // Create the KYC case without a business type.
  const [caseResult] = await db.execute(
    `INSERT INTO kyc_cases (
      user_id,
      status,
      steps_completed
    )
    VALUES (?, 'pending', 0)`,
    [userId],
  );

  const caseId = caseResult.insertId;

  // Initialize all seven KYC steps.
  const steps = Array.from({ length: 7 }, (_, index) => [
    caseId,
    index + 1,
    index === 0 ? "in_progress" : "pending",
  ]);

  await db.query(
    `INSERT INTO kyc_steps (
      case_id,
      step_number,
      status
    )
    VALUES ?`,
    [steps],
  );

  // Record the initial KYC status.
  await db.execute(
    `INSERT INTO kyc_status_history (
      case_id,
      old_status,
      new_status,
      actor_user_id
    )
    VALUES (?, NULL, 'pending', ?)`,
    [caseId, actorId || null],
  );

  return caseId;
}

const userModel = {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  findActiveDefaultScheme,
  insertUser,
  insertSchemeAssignmentHistory,
  updateUserFields,
  findUserSafeById,
  initKycCaseForUser,
};

export {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  findActiveDefaultScheme,
  insertUser,
  insertSchemeAssignmentHistory,
  updateUserFields,
  findUserSafeById,
  initKycCaseForUser,
};

export default userModel;
