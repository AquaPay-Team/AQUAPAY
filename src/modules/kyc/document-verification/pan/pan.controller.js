import asyncHandler from "../../../../utils/asyncHandler.js";
import ApiResponse from "../../../../utils/ApiResponse.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import panService from "./pan.service.js";

const initiateVerification = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }
  const data = await panService.initiateVerification(userId, req.validatedInitiation);
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, data, "PAN authorization started"),
  );
});

export { initiateVerification };
export default { initiateVerification };
