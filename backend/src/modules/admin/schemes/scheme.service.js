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

async function updateSchemeStatus(schemeId, status, actorUserId) {
  if (!actorUserId || !/^[1-9]\d*$/.test(String(actorUserId))) {
    throw new ApiError(401, "Authentication required", [], "UNAUTHORIZED");
  }
  if (status !== 0 && status !== 1) {
    throw new ApiError(400, "Status must be 0 or 1", [], "VALIDATION_ERROR");
  }

  const connection = await pool.getConnection();
  let reusable = true;
  try {
    await connection.beginTransaction();

    // Serialize status updates and future assignments to this scheme.
    const [rows] = await connection.execute(
      `SELECT id, name, status, is_default, created_at
       FROM schemes WHERE id = ? FOR UPDATE`,
      [schemeId],
    );
    const existing = rows[0];
    if (!existing) {
      throw new ApiError(404, "Scheme not found", [], "SCHEME_NOT_FOUND");
    }
    if (Number(existing.is_default) === 1 && status === 0) {
      throw new ApiError(
        403, "Default Scheme cannot be deactivated", [], "DEFAULT_SCHEME_PROTECTED",
      );
    }

    if (status === 0) {
      // Locate the default, then lock only that row by primary key.
      // The default is protected by Migration 009 and cannot be disabled.
      const [defaults] = await connection.execute(
        `SELECT id FROM schemes WHERE is_default = 1 AND status = 1 LIMIT 1`,
      );
      const defaultId = defaults[0]?.id;
      if (defaultId == null) {
        throw new ApiError(500, "Active Default Scheme is not configured", [],
          "DEFAULT_SCHEME_NOT_CONFIGURED");
      }
      const [lockedDefault] = await connection.execute(
        `SELECT id FROM schemes
         WHERE id = ? AND is_default = 1 AND status = 1 FOR SHARE`,
        [defaultId],
      );
      if (!lockedDefault.length) {
        throw new ApiError(500, "Active Default Scheme is not configured", [],
          "DEFAULT_SCHEME_NOT_CONFIGURED");
      }

      // Include inactive/blocked users: their assignment must also be moved.
      // Also repair lingering assignments if an older API already disabled the scheme.
      const [assigned] = await connection.execute(
        `SELECT id FROM users WHERE scheme_id = ? ORDER BY id FOR UPDATE`,
        [schemeId],
      );
      if (assigned.length > 0) {
        const [history] = await connection.execute(
          `INSERT INTO user_scheme_assignments
             (user_id, previous_scheme_id, new_scheme_id, actor_user_id, change_source, reason)
           SELECT id, scheme_id, ?, ?, 'scheme_deactivation', ?
           FROM users WHERE scheme_id = ?`,
          [defaultId, actorUserId, "Reassigned to Default Scheme on deactivation", schemeId],
        );
        const [moved] = await connection.execute(
          `UPDATE users SET scheme_id = ? WHERE scheme_id = ?`,
          [defaultId, schemeId],
        );
        if (history.affectedRows !== assigned.length || moved.affectedRows !== assigned.length) {
          throw new ApiError(409, "Scheme assignments could not be updated", [],
            "SCHEME_UPDATE_CONFLICT");
        }
      }
    }

    // Reactivation changes status only; no former assignments are restored.
    if (Number(existing.status) !== status) {
      const [result] = await connection.execute(
        `UPDATE schemes SET status = ? WHERE id = ? AND is_default = 0`,
        [status, schemeId],
      );
      if (result.affectedRows !== 1) {
        throw new ApiError(409, "Scheme status could not be updated", [],
          "SCHEME_UPDATE_CONFLICT");
      }
    }

    await connection.commit();
    return formatScheme({ ...existing, status });
  } catch (error) {
    try {
      await connection.rollback();
    } catch {
      // Do not return a connection with an uncertain transaction state to the pool.
      reusable = false;
      connection.destroy();
    }
    throw error;
  } finally {
    if (reusable) connection.release();
  }
}

const schemeService = {
  getSchemes,
  createScheme,
  updateSchemeStatus,
};

export { getSchemes, createScheme, updateSchemeStatus };
export default schemeService;
