import asyncHandler from "../../../../utils/asyncHandler.js";
import ApiResponse from "../../../../utils/ApiResponse.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import panService from "./pan.service.js";

const verifyPan = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (userId === undefined || userId === null || userId === "") {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }
  const data = await panService.verifyPan(userId, req.validatedPanRequest);
  const message = data.status === "development_unverified"
    ? "Development mock PAN flow completed; this result is unverified"
    : "PAN verification completed";
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, data, message),
  );
});

export { verifyPan };
export default { verifyPan };
