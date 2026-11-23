
import adminSetupMiddleware from "./adminSetup.middleware.js";
import { Router } from "express";
import {
  validateAdminInput,
  createAdminController,
} from "./admin.controller.js";
import adminKycRoutes from "./kyc/adminKyc.routes.js";
import adminDashboardRoutes from "./dashboard/adminDashboard.routes.js";
import adminUsersRoutes from "./users/adminUsers.routes.js";
import adminOperationsRoutes from "./operations/adminOperations.routes.js";

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

// Admin dashboard summary routes
router.use("/dashboard", adminDashboardRoutes);

// Admin user directory routes
router.use("/users", adminUsersRoutes);

// Admin-only operational monitoring routes
router.use("/operations", adminOperationsRoutes);

export { router };
export default router;
