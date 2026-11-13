import { Router } from "express";
import * as controller from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import { rateLimit } from "../../middlewares/authRateLimit.middleware.js";
import {
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
} from "./auth.validator.js";

const router = Router();

router.post("/login", rateLimit("login"), validateLogin, controller.login);
router.post(
  "/forgot-password",
  rateLimit("forgotPassword"),
  validateForgotPassword,
  controller.forgotPassword
);
router.post(
  "/reset-password",
  rateLimit("resetPassword"),
  validateResetPassword,
  controller.resetPassword
);
router.get("/me", requireAuth, controller.getCurrentUser);

export { router };
export default router;
