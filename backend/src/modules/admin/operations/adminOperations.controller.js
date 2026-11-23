import ApiResponse from "../../../utils/ApiResponse.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import httpStatus from "../../../utils/httpStatus.js";
import adminOperationsService from "./adminOperations.service.js";

const getOperationsOverviewController = asyncHandler(async (req, res) => {
  const overview = await adminOperationsService.getOperationsOverview();
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, overview, "Operations overview fetched successfully"),
  );
});

export { getOperationsOverviewController };
export default { getOperationsOverviewController };
