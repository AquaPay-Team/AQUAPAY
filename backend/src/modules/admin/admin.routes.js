import adminSetupMiddleware from "./adminSetup.middleware.js";
import { Router } from "express";
import { validateAdminInput, createAdminController } from "./admin.controller.js";
import { rateLimit } from "../../middlewares/authRateLimit.middleware.js";
const router = Router();

router.post(
  "/create",
  rateLimit("adminCreation"),
  adminSetupMiddleware.verifyAdminSetupKey,
  validateAdminInput,
  createAdminController,
);

export { router };
export default router;
