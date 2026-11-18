
import adminSetupMiddleware from "./adminSetup.middleware.js";
import { Router } from "express";
import {
  validateAdminInput,
  createAdminController,
} from "./admin.controller.js";
import adminKycRoutes from "./kyc/adminKyc.routes.js";

const router = Router();

// Existing admin creation route
router.post(
  "/create",
  adminSetupMiddleware.verifyAdminSetupKey,
  validateAdminInput,
  createAdminController
);

// Admin KYC routes
router.use("/kyc", adminKycRoutes);

export { router };
export default router;
