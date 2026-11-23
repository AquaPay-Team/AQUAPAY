import { Router } from "express";
import { requireAuth, requireAdmin } from "../../../middlewares/auth.middleware.js";
import { getDashboardSummaryController } from "./adminDashboard.controller.js";

const router = Router();

router.get(
  "/summary",
  requireAuth,
  requireAdmin,
  getDashboardSummaryController,
);

export { router };
export default router;
