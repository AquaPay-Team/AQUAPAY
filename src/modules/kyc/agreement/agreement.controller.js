import agreementService from "./agreement.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const getAgreementDetails = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await agreementService.getAgreementDetails(userId);

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      data,
      "Agent agreement details retrieved successfully",
    ),
  );
});

const acceptAgreement = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const data = await agreementService.acceptAgreement(
    userId,
    req.validatedBody,
  );

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      data,
      "Agent agreement accepted successfully",
    ),
  );
});

export { getAgreementDetails, acceptAgreement };

export default {
  getAgreementDetails,
  acceptAgreement,
};

