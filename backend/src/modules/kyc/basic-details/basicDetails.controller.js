import basicDetailsService from "./basicDetails.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const saveBasicDetails = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await basicDetailsService.saveBasicDetails(userId, req.validatedBody);
  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, data, "Basic details saved successfully"));
});

const requestStep1Otp = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  await basicDetailsService.requestStep1Otp(userId, req.ip || req.socket?.remoteAddress);
  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, null, "OTP requested successfully"));
});

const verifyStep1Otp = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await basicDetailsService.verifyStep1Otp(
    userId,
    req.validatedOtp,
    req.ip || req.socket?.remoteAddress,
  );
  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, { steps_completed: data.steps_completed }, data.message));
});

export { saveBasicDetails, requestStep1Otp, verifyStep1Otp };
export default { saveBasicDetails, requestStep1Otp, verifyStep1Otp };
