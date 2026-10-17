const userService = require("./user.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");

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

module.exports = {
  createUser,
};
