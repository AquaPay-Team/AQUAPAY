import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import service from "./reset-password.service.js";

const resetSubordinatePassword = asyncHandler(async (req, res) => {
  const actorId = req.user?.id;
  if (!actorId) throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  const result = await service.resetSubordinatePassword({ actorId, targetUserId: req.params.id, ...req.validatedBody });
  return res.status(httpStatus.OK).json(new ApiResponse(httpStatus.OK, null, result.message));
});

export { resetSubordinatePassword };
