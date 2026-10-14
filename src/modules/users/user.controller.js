const userService = require("./user.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");

const createUser = asyncHandler(async (req, res) => {
  const actorId = req.user ? req.user.id : (req.headers["x-user-id"] || req.headers["user-id"]);

  if (!actorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required to create a user", [], "UNAUTHORIZED");
  }

  const { name, email, mobile, password, roleId } = req.validatedBody || req.body;

  const newUser = await userService.createUser({
    actorId: Number(actorId),
    name,
    email,
    mobile,
    password,
    roleId
  });

  return res
    .status(httpStatus.CREATED)
    .json(new ApiResponse(httpStatus.CREATED, newUser, "User created successfully"));
});

module.exports = {
  createUser
};

