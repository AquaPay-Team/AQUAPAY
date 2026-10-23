import getUserModel from "./get-user.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

async function getActor(actorId) {
  const parentId = Number(actorId);
  if (!actorId || !Number.isSafeInteger(parentId) || parentId <= 0) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  const actor = await getUserModel.findActorRole(parentId);
  if (!actor) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Active authenticated user not found", [], "UNAUTHORIZED");
  }

  return actor;
}

function isAdmin(actor) {
  return actor.role_id === 1 || actor.role_slug === "AD";
}

async function getUsers(actorId, options = {}) {
  const actor = await getActor(actorId);

  if (isAdmin(actor)) {
    return getUserModel.findAllUsers(options);
  }

  return getUserModel.findChildrenByParentId(actor.id, options);
}

async function getUserById(actorId, userId) {
  const actor = await getActor(actorId);

  const childId = Number(userId);
  if (!userId || !Number.isSafeInteger(childId) || childId <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID", [], "VALIDATION_ERROR");
  }

  if (isAdmin(actor)) {
    const user = await getUserModel.findUserById(childId);
    if (!user) {
      throw new ApiError(httpStatus.NOT_FOUND, "User not found", [], "NOT_FOUND");
    }
    return user;
  }

  const child = await getUserModel.findChildByIdAndParentId(childId, actor.id);
  if (!child) {
    throw new ApiError(httpStatus.NOT_FOUND, "Child user not found or not created by you", [], "NOT_FOUND");
  }

  return child;
}

const getUserService = {
  getUsers,
  getUserById,
};

export {
  getUsers,
  getUserById,
};

export default getUserService;