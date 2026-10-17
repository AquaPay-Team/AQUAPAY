const userService = require("./user.service");
const asyncHandler = require("../../utils/asyncHandler");
const ApiResponse = require("../../utils/ApiResponse");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("../../utils/httpStatus");

function getActorId(req) {
  const actorId = req.user ? req.user.id : (req.headers["x-user-id"] || req.headers["user-id"]);
  if (!actorId) {
    throw new ApiError(httpStatus.UNAUTHORIZED, "Authentication required", [], "UNAUTHORIZED");
  }
  return Number(actorId);
}

const createUser = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const { name, email, mobile, state, city, password, roleId, parentId } = req.validatedBody || req.body;

  const result = await userService.createUser({
    actorId,
    name,
    email,
    mobile,
    state,
    city,
    password,
    roleId,
    parentId
  });

  return res
    .status(httpStatus.CREATED)
    .json(new ApiResponse(httpStatus.CREATED, result, "User created successfully"));
});

const listUsers = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const result = await userService.listUsers(actorId, req.validatedQuery || req.query);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, result, "Users retrieved successfully"));
});

const getUser = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const targetUserId = req.userIdParam;

  const user = await userService.getUser(actorId, targetUserId);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, user, "User retrieved successfully"));
});

const updateUser = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const targetUserId = req.userIdParam;

  const updatedUser = await userService.updateUser(actorId, targetUserId, req.validatedBody || req.body);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, updatedUser, "User updated successfully"));
});

const updateUserStatus = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const targetUserId = req.userIdParam;
  const { status } = req.validatedBody || req.body;

  const result = await userService.updateUserStatus(actorId, targetUserId, status);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, result, "User status updated successfully"));
});

const deleteUser = asyncHandler(async (req, res) => {
  const actorId = getActorId(req);
  const targetUserId = req.userIdParam;

  const result = await userService.deleteUser(actorId, targetUserId);

  return res
    .status(httpStatus.OK)
    .json(new ApiResponse(httpStatus.OK, result, "User deleted successfully"));
});

module.exports = {
  createUser,
  listUsers,
  getUser,
  updateUser,
  updateUserStatus,
  deleteUser
};
