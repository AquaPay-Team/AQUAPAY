const authService = require("./auth.service");
const asyncHandler = require("../../utils/asyncHandler");

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.validatedBody);
  res.status(200).json({ success: true, message: "Login successful", data });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, message: "User retrieved successfully", data });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const result = await authService.forgotPassword(req.validatedBody);
  res.status(200).json({ success: true, message: result.message, data: null });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.validatedBody);
  res.status(200).json({ success: true, message: result.message, data: null });
});

module.exports = { login, getCurrentUser, forgotPassword, resetPassword };
