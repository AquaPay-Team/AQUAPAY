const router = require("express").Router();
const controller = require("./auth.controller");
const { requireAuth } = require("../../middlewares/auth.middleware");
const { rateLimit } = require("../../middlewares/authRateLimit.middleware");
const {
  validateLogin,
  validateForgotPassword,
  validateResetPassword
} = require("./auth.validator");

router.post("/login", rateLimit("login"), validateLogin, controller.login);
router.post("/forgot-password", rateLimit("forgotPassword"), validateForgotPassword, controller.forgotPassword);
router.post("/reset-password", rateLimit("resetPassword"), validateResetPassword, controller.resetPassword);
router.get("/me", requireAuth, controller.getCurrentUser);

module.exports = router;
