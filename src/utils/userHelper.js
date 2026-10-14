import pool from "../config/db.js";
import bcrypt from "bcryptjs";
import { getChildSlug, ROLES } from "../constants/roles.js";
import ApiError from "./ApiError.js";

const db = (connection) => connection ?? pool;

export function normalizeRoleSlug(slug) {
  return typeof slug === "string" ? slug.trim().toUpperCase() : "";
}

export function getRoleInfo(slug) {
  const normalized = normalizeRoleSlug(slug);
  return ROLES.find((role) => role.slug === normalized) ?? null;
}

export function isValidRole(slug) {
  return getRoleInfo(slug) !== null;
}

export function canCreateChildRole(parentSlug, childSlug) {
  const parent = normalizeRoleSlug(parentSlug);
  const child = normalizeRoleSlug(childSlug);
  return Boolean(child) && getChildSlug(parent) === child;
}

export async function hashPassword(password) {
  if (typeof password !== "string" || password.length < 12) {
    throw new ApiError(422, "Password must contain at least 12 characters");
  }
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, passwordHash) {
  if (typeof password !== "string" || typeof passwordHash !== "string" || !passwordHash) {
    return false;
  }
  return bcrypt.compare(password, passwordHash);
}

export async function getUserById(userId, companyId, connection) {
  const [rows] = await db(connection).execute(
    `SELECT u.id, u.company_id, u.role_id, u.parent_id,
            u.name, u.email, u.mobile, u.status, u.kyc, u.created_at,
            r.slug AS role_slug, r.name AS role_name, r.level AS role_level
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND u.company_id = ?
     LIMIT 1`,
    [userId, companyId]
  );
  return rows[0] ?? null;
}

export async function getAllowedChildRole(parentSlug, connection) {
  const childSlug = getChildSlug(normalizeRoleSlug(parentSlug));
  if (!childSlug) return null;

  const [rows] = await db(connection).execute(
    `SELECT id, slug, name, level
     FROM roles
     WHERE slug = ? AND is_active = TRUE
     LIMIT 1`,
    [childSlug]
  );
  return rows[0] ?? null;
}

export async function validateChildRole(parentSlug, requestedSlug, connection) {
  const childSlug = normalizeRoleSlug(requestedSlug);

  if (!canCreateChildRole(parentSlug, childSlug)) {
    throw new ApiError(403, "You cannot create this role");
  }

  const role = await getAllowedChildRole(parentSlug, connection);
  if (!role || role.slug !== childSlug) {
    throw new ApiError(403, "Requested role is inactive or unavailable");
  }

  return role;
}

export async function userExists({ companyId, email, mobile, excludeUserId }, connection) {
  const conditions = [];
  const params = [companyId];

  if (email) {
    conditions.push("email = ?");
    params.push(email.trim().toLowerCase());
  }
  if (mobile) {
    conditions.push("mobile = ?");
    params.push(mobile.trim());
  }
  if (!conditions.length) return false;

  let sql = `SELECT id FROM users
             WHERE company_id = ? AND (${conditions.join(" OR ")})`;
  if (excludeUserId != null) {
    sql += " AND id <> ?";
    params.push(excludeUserId);
  }
  sql += " LIMIT 1";

  const [rows] = await db(connection).execute(sql, params);
  return rows.length > 0;
}

export async function getDirectChildren(parentId, companyId, connection) {
  const [rows] = await db(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.parent_id, u.status,
            r.slug AS role_slug, r.name AS role_name, r.level AS role_level
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE u.parent_id = ? AND u.company_id = ?
     ORDER BY u.id DESC`,
    [parentId, companyId]
  );
  return rows;
}

export async function getUsers({
  companyId, roleSlug, parentId, status, page, limit, offset
}, connection) {
  const conditions = ["u.company_id = ?"];
  const params = [companyId];

  if (roleSlug) {
    conditions.push("r.slug = ?");
    params.push(normalizeRoleSlug(roleSlug));
  }
  if (parentId !== undefined) {
    conditions.push("u.parent_id <=> ?");
    params.push(parentId);
  }
  if (status) {
    conditions.push("u.status = ?");
    params.push(status);
  }

  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 20)));
  const safeOffset = Math.max(0, Math.floor(Number(offset) || 0));

  const [rows] = await db(connection).execute(
    `SELECT u.id, u.name, u.email, u.mobile, u.parent_id,
            u.status, u.created_at,
            r.slug AS role_slug, r.name AS role_name, r.level AS role_level
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY u.id DESC
     LIMIT ${safeLimit} OFFSET ${safeOffset}`,
    params
  );

  return rows;
}

export async function insertUser({
  companyId, roleId, parentId, name, email, mobile, passwordHash
}, connection) {
  if (!connection) {
    throw new Error("A MySQL transaction connection is required");
  }

  const [result] = await connection.execute(
    `INSERT INTO users
       (company_id, role_id, parent_id, name, email, mobile, password_hash)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      companyId,
      roleId,
      parentId ?? null,
      name.trim(),
      email ? email.trim().toLowerCase() : null,
      mobile.trim(),
      passwordHash,
    ]
  );

  return result.insertId;
}

export async function createDefaultWallets(userId, connection) {
  if (!connection) {
    throw new Error("A MySQL transaction connection is required");
  }

  await connection.execute(
    `INSERT INTO wallets (user_id, wallet_type)
     VALUES (?, 'MAIN'), (?, 'AEPS'), (?, 'PG'), (?, 'QR'), (?, 'SETTLEMENT')`,
    [userId, userId, userId, userId, userId]
  );
}
