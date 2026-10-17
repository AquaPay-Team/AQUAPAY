
const authorizationModel = require("./authorization.model");

async function canCreateRole(actorRoleId, targetRoleId, connection) {
  if (!actorRoleId || !targetRoleId) {
    return false;
  }

  if (Number(actorRoleId) === Number(targetRoleId)) {
    return false;
  }

  return authorizationModel.isRoleBelow(
    actorRoleId,
    targetRoleId,
    connection
  );
}

module.exports = {
  canCreateRole,
};
