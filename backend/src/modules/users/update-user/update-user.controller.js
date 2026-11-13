
import updateUserService from "./update-user.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

function getActorId(req) {
  const actorId = req.user?.id;

  if (!actorId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  return actorId;
}

const updateUser = asyncHandler(async (req, res) => {
  const updatedUser = await updateUserService.updateUser({
    actorId: getActorId(req),
    targetUserId: req.params.id,
    fields: req.validatedBody,
  });

  return res.status(httpStatus.OK).json(
    new ApiResponse(
      httpStatus.OK,
      updatedUser,
      "User updated successfully",
    ),
  );
});

export { updateUser };
