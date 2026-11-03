import submissionService from "./submission.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const getSubmissionStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await submissionService.getSubmissionStatus(userId);

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      data,
      "KYC submission status retrieved successfully",
    ),
  );
});

const submitKycApplication = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await submissionService.submitKycApplication(
    userId,
    req.validatedBody,
  );

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      data,
      data.alreadySubmitted
        ? "KYC application has already been submitted"
        : "KYC application submitted successfully",
    ),
  );
});

export { getSubmissionStatus, submitKycApplication };

export default {
  getSubmissionStatus,
  submitKycApplication,
};

