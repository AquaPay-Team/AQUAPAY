import pool from "../../../config/db.js";
import ApiError from "../../../utils/ApiError.js";

function formatScheme(row) {
  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    status: String(row.status),
    is_default: Number(row.is_default) === 1,
    created_at: row.created_at,
  };
}

async function getSchemeById(schemeId) {
  const [rows] = await pool.execute(
    `SELECT id, name, status, is_default, created_at
     FROM schemes
     WHERE id = ?
     LIMIT 1`,
    [schemeId],
  );

  return formatScheme(rows[0]);
}

async function getSchemes(search = "") {
  let sql = `SELECT id, name, status, is_default, created_at FROM schemes`;
  const params = [];

  if (search) {
    sql += ` WHERE name LIKE ?`;
    params.push(`%${search}%`);
  }

  sql += ` ORDER BY id ASC`;

  const [rows] = await pool.execute(sql, params);
  return rows.map(formatScheme);
}

async function createScheme(name) {
  try {
    const [result] = await pool.execute(
      `INSERT INTO schemes (name, status, is_default)
       VALUES (?, 1, 0)`,
      [name],
    );

    return getSchemeById(result.insertId);
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      throw new ApiError(
        409,
        "A scheme with this name already exists",
        [],
        "DUPLICATE_SCHEME",
      );
    }
    throw error;
  }
}

async function updateSchemeStatus(schemeId, status) {
  const [rows] = await pool.execute(
    `SELECT id, name, status, is_default, created_at
     FROM schemes
     WHERE id = ?
     LIMIT 1`,
    [schemeId],
  );
  const existing = rows[0];

  if (!existing) {
    throw new ApiError(404, "Scheme not found", [], "SCHEME_NOT_FOUND");
  }

  if (Number(existing.is_default) === 1) {
    if (status === 0) {
      throw new ApiError(
        403,
        "Default Scheme cannot be deactivated",
        [],
        "DEFAULT_SCHEME_PROTECTED",
      );
    }
    return formatScheme(existing);
  }

  // Repeating the same status is safe and should not be treated as an error.
  if (Number(existing.status) === status) {
    return formatScheme(existing);
  }

  // Guard at write time too: even if the row changes, never deactivate a default.
  const [result] = await pool.execute(
    `UPDATE schemes SET status = ? WHERE id = ? AND is_default = 0`,
    [status, schemeId],
  );

  const updated = await getSchemeById(schemeId);
  if (!updated) {
    throw new ApiError(404, "Scheme not found", [], "SCHEME_NOT_FOUND");
  }
  if (updated.is_default && status === 0) {
    throw new ApiError(
      403,
      "Default Scheme cannot be deactivated",
      [],
      "DEFAULT_SCHEME_PROTECTED",
    );
  }
  if (result.affectedRows === 0 && Number(updated.status) !== status) {
    throw new ApiError(409, "Scheme status could not be updated", [], "SCHEME_UPDATE_CONFLICT");
  }

  return updated;
}

const schemeService = {
  getSchemes,
  createScheme,
  updateSchemeStatus,
};

export { getSchemes, createScheme, updateSchemeStatus };
export default schemeService;
