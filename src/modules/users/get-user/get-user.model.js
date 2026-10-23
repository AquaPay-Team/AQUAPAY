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
    k.current_step AS kyc_current_step,
    k.business_type AS kyc_business_type,
    k.submitted_at AS kyc_submitted_at,
    k.reviewed_at AS kyc_reviewed_at,
    k.rejection_reason AS kyc_rejection_reason,
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
  delete user.kyc_current_step;
  delete user.kyc_business_type;
  delete user.kyc_submitted_at;
  delete user.kyc_reviewed_at;
  delete user.kyc_rejection_reason;

  user.kyc = row.kyc_case_id
    ? {
        case_id: row.kyc_case_id,
        status: row.kyc_status,
        current_step: row.kyc_current_step,
        business_type: row.kyc_business_type,
        submitted_at: row.kyc_submitted_at,
        reviewed_at: row.kyc_reviewed_at,
        rejection_reason: row.kyc_rejection_reason,
      }
    : null;

  return user;
}

// Retrieve KYC steps for a single user case
async function findKycStepsByCaseId(caseId) {
  if (!caseId) return [];
  const [rows] = await pool.execute(
    `SELECT step_number, status, completed_at, failure_code
     FROM kyc_steps
     WHERE case_id = ?
     ORDER BY step_number ASC`,
    [caseId],
  );
  return rows;
}

// Retrieve caller role to determine admin privileges
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

// Get all users (Admin view) with optional KYC status filter
async function findAllUsers(options = {}) {
  let query = `${USER_PROJECTION}`;
  const params = [];

  if (options.kycStatus) {
    query += ` WHERE k.status = ?`;
    params.push(options.kycStatus);
  }

  query += ` ORDER BY u.id DESC`;

  const [rows] = await pool.execute(query, params);
  return rows.map(formatUserRow);
}

// Get single user by ID (Admin view) with KYC steps
async function findUserById(userId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ?
     LIMIT 1`,
    [userId],
  );
  const user = formatUserRow(rows[0]);
  if (user && user.kyc?.case_id) {
    user.kyc.steps = await findKycStepsByCaseId(user.kyc.case_id);
  }
  return user;
}

// Get all children created by a parent (Non-admin view) with optional KYC status filter
async function findChildrenByParentId(parentId, options = {}) {
  let query = `${USER_PROJECTION} WHERE u.parent_id = ?`;
  const params = [parentId];

  if (options.kycStatus) {
    query += ` AND k.status = ?`;
    params.push(options.kycStatus);
  }

  query += ` ORDER BY u.id DESC`;

  const [rows] = await pool.execute(query, params);
  return rows.map(formatUserRow);
}

// Get a single child created by a parent (Non-admin view) with KYC steps
async function findChildByIdAndParentId(childId, parentId) {
  const [rows] = await pool.execute(
    `${USER_PROJECTION}
     WHERE u.id = ? AND u.parent_id = ?
     LIMIT 1`,
    [childId, parentId],
  );
  const child = formatUserRow(rows[0]);
  if (child && child.kyc?.case_id) {
    child.kyc.steps = await findKycStepsByCaseId(child.kyc.case_id);
  }
  return child;
}

export {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findKycStepsByCaseId,
  formatUserRow,
};

export default {
  findActorRole,
  findAllUsers,
  findUserById,
  findChildrenByParentId,
  findChildByIdAndParentId,
  findKycStepsByCaseId,
  formatUserRow,
};