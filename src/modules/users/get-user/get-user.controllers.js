import service from "./get-user.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

function getActorId(req) {
  const actorId = req.user?.id;

  if (!actorId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  return Number(actorId);
}

const getUsers = asyncHandler(async (req, res) => { 
  const actorId = getActorId(req);
  const result = await service.getUsers(actorId);

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result, "Users fetched successfully")
  );
});

const getUserById = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const user = await service.getUserById(actorId, req.params.id);

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, user, "User details fetched successfully")
  );
});

export { getUsers, getUserById };
export default { getUsers, getUserById };