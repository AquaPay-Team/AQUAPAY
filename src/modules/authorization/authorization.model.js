import defaultPool from "../../config/db.js";

async function isRoleBelow(actorRoleId, targetRoleId, connection) {
  const db = connection || defaultPool;

  const [rows] = await db.execute(
    `WITH RECURSIVE allowed_roles AS (
       SELECT child_role_id
       FROM role_hierarchy
       WHERE parent_role_id = ?

       UNION DISTINCT

       SELECT hierarchy.child_role_id
       FROM role_hierarchy hierarchy
       INNER JOIN allowed_roles allowed
         ON hierarchy.parent_role_id = allowed.child_role_id
     )
     SELECT 1 AS permitted
     FROM allowed_roles
     WHERE child_role_id = ?
     LIMIT 1`,
    [actorRoleId, targetRoleId]
  );

  return rows.length > 0;
}

const authorizationModel = {
  isRoleBelow,
};

export {
  isRoleBelow,
};

export default authorizationModel;

