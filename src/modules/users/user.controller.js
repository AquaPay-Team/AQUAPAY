import userService from "./user.service.js";
import asyncHandler from "../../utils/asyncHandler.js";
import ApiResponse from "../../utils/ApiResponse.js";
import ApiError from "../../utils/ApiError.js";
import httpStatus from "../../utils/httpStatus.js";

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

const createUser = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const { name, email, mobile, state, city, password, roleId } =
    req.validatedBody || req.body;

  const result = await userService.createUser({
    actorId,
    name,
    email,
    mobile,
    state,
    city,
    password,
    roleId,
  });

  return res
    .status(httpStatus.CREATED)
    .json(
      new ApiResponse(httpStatus.CREATED, result, "User created successfully"),
    );
});

export { createUser };
export default { createUser };
