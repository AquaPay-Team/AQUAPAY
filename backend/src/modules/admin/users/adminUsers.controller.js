import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import httpStatus from "../../../utils/httpStatus.js";
import adminUsersService from "./adminUsers.service.js";

const getAdminUsersController = asyncHandler(async (req, res) => {
  const result = await adminUsersService.getAdminUsers(req.query || {});

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result, "Users fetched successfully"),
  );
});

export { getAdminUsersController };
export default { getAdminUsersController };
