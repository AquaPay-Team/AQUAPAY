import * as service from "./get-user.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import httpStatus from "../../../utils/httpStatus.js";

const getUsers = asyncHandler(async (req, res) => {
  const result = await service.getUsers(req.user.id);

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result, "Users fetched successfully")
  );
});

const getUserById = asyncHandler(async (req, res) => {
  const user = await service.getUserById(req.user.id, req.params.id);

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, user, "User details fetched successfully")
  );
});

export { getUsers, getUserById };
export default { getUsers, getUserById };