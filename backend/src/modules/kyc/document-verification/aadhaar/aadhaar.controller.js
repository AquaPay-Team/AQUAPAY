import asyncHandler from "../../../../utils/asyncHandler.js";
import ApiResponse from "../../../../utils/ApiResponse.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import aadhaarService from "./aadhaar.service.js";

const initiateVerification = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }
  const data = await aadhaarService.initiateVerification(userId, req.validatedInitiation);
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, data, "Aadhaar authorization started"),
  );
});

const getVerificationStatus = asyncHandler(async (req, res) => {
  const userId = req.user?.id;
  if (!userId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }
  const sessionId = req.query?.sessionId;
  if (sessionId !== undefined && (typeof sessionId !== "string" ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(sessionId))) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid DigiLocker session ID", [], "INVALID_SESSION_ID");
  }
  const data = await aadhaarService.getVerificationStatus(userId, sessionId);
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, data, "Aadhaar verification status retrieved"),
  );
});

export { initiateVerification, getVerificationStatus };
export default { initiateVerification, getVerificationStatus };
