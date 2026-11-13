import bankDetailsService from "./bankDetails.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const saveBankDetails = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await bankDetailsService.saveBankDetails(
    userId,
    req.validatedBody,
  );

  return res
    .status(httpStatus.OK)
    .json(
      new ApiResponse(httpStatus.OK, data, "Bank details saved successfully"),
    );
});

const getBankDetails = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await bankDetailsService.getBankDetails(userId);

  return res
    .status(httpStatus.OK)
    .json(
      new ApiResponse(
        httpStatus.OK,
        data,
        "Bank details retrieved successfully",
      ),
    );
});

export { saveBankDetails, getBankDetails };

export default {
  saveBankDetails,
  getBankDetails,
};
