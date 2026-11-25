import authService from "./auth.service.js";
import recoveryDelivery from "./recoveryDelivery.js";
import asyncHandler from "../../utils/asyncHandler.js";

const login = asyncHandler(async (req, res) => {
  const data = await authService.login(req.validatedBody);
  res.status(200).json({ success: true, message: "Login successful", data });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const data = await authService.getCurrentUser(req.user.id);
  res.status(200).json({ success: true, message: "User retrieved successfully", data });
});

const forgotPassword = asyncHandler(async (req, res) => {
  recoveryDelivery.clearLatestDevOtp();
  const result = await authService.forgotPassword(req.validatedBody);
  const data = process.env.NODE_ENV === "development" && result.developmentResetToken
    ? {
        resetToken: result.developmentResetToken,
        developmentOtp: recoveryDelivery.getLatestDevOtp(),
      }
    : null;
  res.status(200).json({ success: true, message: result.message, data });
});

const resetPassword = asyncHandler(async (req, res) => {
  const result = await authService.resetPassword(req.validatedBody);
  res.status(200).json({ success: true, message: result.message, data: null });
});

const changePassword = asyncHandler(async (req, res) => {
  const result = await authService.changePassword(req.user?.id, req.validatedBody);
  res.status(200).json({ success: true, message: result.message, data: null });
});

export { login, getCurrentUser, forgotPassword, resetPassword, changePassword };
export default { login, getCurrentUser, forgotPassword, resetPassword, changePassword };
