
import { Router } from "express";
import adminKycController from "./adminKyc.controller.js";

import {
  requireAuth,
  requireAdmin,
} from "../../../middlewares/auth.middleware.js";

const router = Router();

// Fetch all KYC applications
router.get(
  "/",
  requireAuth,
  requireAdmin,
  adminKycController.getKycApplicationsController,
);

// Fetch details of one KYC application
router.get(
  "/:caseId",
  requireAuth,
  requireAdmin,
  adminKycController.getKycApplicationDetailsController,
);

// Generate temporary secure access to a KYC document
router.get(
  "/:caseId/documents/:assetId",
  requireAuth,
  requireAdmin,
  adminKycController.getKycDocumentAccessController,
);

router.patch(
  "/:caseId/approve",
  requireAuth,
  requireAdmin,
  adminKycController.approveKycApplicationController,
);

export { router };
export default router;
