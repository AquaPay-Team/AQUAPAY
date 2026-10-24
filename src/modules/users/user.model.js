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
    shopname,
    address,
    state,
    city,
    pincode,
    passwordHash,
    roleId,
    companyId,
    parentId,
    status = "active",
  },
  connection,
) {
  const [result] = await getDb(connection).execute(
    `INSERT INTO users (name, email, mobile, shopname, address, state, city, pincode, password_hash, role_id, company_id, parent_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name,
      email,
      mobile,
      shopname || null,
      address || null,
      state || null,
      city || null,
      pincode || null,
      passwordHash,
      roleId,
      companyId || null,
      parentId || null,
      status,
    ],
  );
  return result.insertId;
}

async function initKycCaseForUser(
  { userId, businessType = null, actorId = null },
  connection,
) {
  const db = getDb(connection);

  const [caseResult] = await db.execute(
    `INSERT INTO kyc_cases (user_id, business_type, status, current_step)
     VALUES (?, ?, 'draft', 1)`,
    [userId, businessType],
  );
  const caseId = caseResult.insertId;

  const stepRows = [
    [caseId, 1, "in_progress"],
    [caseId, 2, "pending"],
    [caseId, 3, "pending"],
    [caseId, 4, "pending"],
    [caseId, 5, "pending"],
    [caseId, 6, "pending"],
    [caseId, 7, "pending"],
  ];

  await db.query(
    `INSERT INTO kyc_steps (case_id, step_number, status) VALUES ?`,
    [stepRows],
  );

  await db.execute(
    `INSERT INTO kyc_status_history (case_id, old_status, new_status, actor_user_id, reason)
     VALUES (?, NULL, 'draft', ?, 'Initial KYC case created during user registration')`,
    [caseId, actorId],
  );

  return {
    caseId,
    status: "draft",
    currentStep: 1,
  };
}

async function findUserSafeById(userId, connection) {
  const [rows] = await getDb(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.shopname, u.address, u.state, u.city, u.pincode, u.role_id, u.company_id, u.parent_id, u.status, u.created_at, u.updated_at,
            r.name AS role_name, r.slug AS role_slug,
            p.name AS parent_name,
            c.name AS company_name,
            k.id AS kyc_case_id,
            k.status AS kyc_status,
            k.current_step AS kyc_current_step,
            k.business_type AS kyc_business_type
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN users p ON p.id = u.parent_id
     LEFT JOIN companies c ON c.id = u.company_id
     LEFT JOIN kyc_cases k ON k.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );

  if (!rows[0]) return null;
  const row = rows[0];

  const user = { ...row };
  delete user.kyc_case_id;
  delete user.kyc_status;
  delete user.kyc_current_step;
  delete user.kyc_business_type;

  user.kyc = row.kyc_case_id
    ? {
      case_id: row.kyc_case_id,
      status: row.kyc_status,
      current_step: row.kyc_current_step,
      business_type: row.kyc_business_type,
    }
    : null;

  return user;
}

const userModel = {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  initKycCaseForUser,
  findUserSafeById,
};

export {
  findUserForAuth,
  findRoleByIdOrName,
  checkRoleHierarchy,
  checkDuplicateUser,
  insertUser,
  initKycCaseForUser,
  findUserSafeById,
};

export default userModel;

