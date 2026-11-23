import ApiResponse from "../../../utils/ApiResponse.js";
import httpStatus from "../../../utils/httpStatus.js";
import adminDashboardService from "./adminDashboard.service.js";

async function getDashboardSummaryController(req, res, next) {
  try {
    const summary = await adminDashboardService.getDashboardSummary();

    return res.status(httpStatus.OK).json(
      new ApiResponse(
        httpStatus.OK,
        summary,
        "Dashboard summary fetched successfully",
      ),
    );
  } catch (error) {
    return next(error);
  }
}

export { getDashboardSummaryController };
export default { getDashboardSummaryController };
