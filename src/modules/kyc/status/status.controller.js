import statusService from "./status.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const getStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await statusService.getStatus(userId);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, data, "KYC status retrieved successfully"));
});

export { getStatus };
export default { getStatus };
