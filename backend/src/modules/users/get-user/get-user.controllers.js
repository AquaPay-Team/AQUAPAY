import service from "./get-user.service.js";
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

  return Number(actorId);
}



const getUsers = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const { kyc_status, kycStatus, search, page, pageSize, page_size } = req.query || {};

  const result = await service.getUsers(actorId, {
    kycStatus: kyc_status || kycStatus,
    search,
    page,
    pageSize: pageSize ?? page_size,
  });

  let message = "Users fetched successfully";

  if (result.length === 0) {
    const isAdmin = req.user?.role_id === 1 || req.user?.role_slug === "AD";

    message = isAdmin
      ? "No users found"
      : "You haven't created any users yet";
  }

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, result, message),
  );
});



const getUserById = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const user = await service.getUserById(actorId, req.params.id);

  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, user, "User details fetched successfully")
  );
});

export { getUsers, getUserById };
export default { getUsers, getUserById };
