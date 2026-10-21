import authorizationModel from "./authorization.model.js";

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

const authorizationService = {
  canCreateRole,
};

export {
  canCreateRole,
};

export default authorizationService;

