
import pool from "../../../config/db.js";

async function updateUser(id, data) {
  const fields = Object.keys(data);

  const setQuery = fields.map((field) => `${field} = ?`).join(", ");
  const values = fields.map((field) => data[field]);

  await pool.execute(
    `UPDATE users SET ${setQuery} WHERE id = ?`,
    [...values, id]
  );
}

export default { updateUser };
