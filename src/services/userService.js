
import pool from "../config/db.js";

import {
  getUserById,
  validateChildRole,
  userExists,
  hashPassword,
  insertUser,
  createDefaultWallets,
} from "../utils/userHelper.js";

import ApiError from "../utils/ApiError.js";

export async function createUser({
  actorId,
  name,
  email,
  mobile,
  password,
  roleSlug,
}) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // 1. Find the authenticated creator.
    const [actors] = await connection.execute(
      `SELECT
          u.id,
          u.company_id,
          u.status,
          r.slug AS role_slug
       FROM users u
       JOIN roles r ON r.id = u.role_id
       JOIN companies c ON c.id = u.company_id
       WHERE u.id = ?
         AND u.status = 'active'
         AND c.status = 'active'
       FOR UPDATE`,
      [actorId]
    );

    if (!actors.length) {
      throw new ApiError(401, "Active creator not found");
    }

    const actor = actors[0];

    // 2. Validate the requested child role.
    const role = await validateChildRole(
      actor.role_slug,
      roleSlug,
      connection
    );

    // 3. Check whether the email or mobile already exists.
    const exists = await userExists(
      {
        companyId: actor.company_id,
        email,
        mobile,
      },
      connection
    );

    if (exists) {
      throw new ApiError(
        409,
        "Email or mobile already exists"
      );
    }

    // 4. Hash the password.
    const passwordHash = await hashPassword(password);

    // 5. Insert the user with the creator as the parent.
    const newUserId = await insertUser(
      {
        companyId: actor.company_id,
        roleId: role.id,
        parentId: actor.id,
        name,
        email,
        mobile,
        passwordHash,
      },
      connection
    );

    // 6. Create default wallets.
    await createDefaultWallets(newUserId, connection);

    // 7. Fetch the created user without sensitive fields.
    const newUser = await getUserById(
      newUserId,
      actor.company_id,
      connection
    );

    // 8. Commit all database changes.
    await connection.commit();

    return newUser;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
