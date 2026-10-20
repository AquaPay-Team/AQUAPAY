import getUserModel from "./get-user.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

async function getUsers(actorId) {
  if (!actorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  return getUserModel.findChildrenByParentId(actorId);
}

async function getUserById(actorId, userId) {
  if (!actorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }

  const childId = Number(userId);
  if (!userId || isNaN(childId) || childId <= 0) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid user ID", [], "VALIDATION_ERROR");
  }

  const child = await getUserModel.findChildByIdAndParentId(childId, actorId);
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