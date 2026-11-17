import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { validateAdminPasswordReset } from "./reset-password.validator.js";
import { resetSubordinatePassword } from "./reset-password.controller.js";

const router = Router();
router.post("/:id/reset-password", requireAuth, validateAdminPasswordReset, resetSubordinatePassword);
export default router;
