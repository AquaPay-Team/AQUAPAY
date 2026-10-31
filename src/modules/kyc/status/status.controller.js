import asyncHandler from "../../../utils/asyncHandler.js";
import ApiError from "../../../utils/ApiError.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import httpStatus from "../../../utils/httpStatus.js";
import statusService from "./status.service.js";

const getKycStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await statusService.getKycStatus(userId);
  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, data, "KYC status retrieved successfully"));
});

export { getKycStatus };
export default { getKycStatus };
