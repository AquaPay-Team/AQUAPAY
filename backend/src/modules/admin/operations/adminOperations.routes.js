import { Router } from "express";
import { requireAdmin, requireAuth } from "../../../middlewares/auth.middleware.js";
import { getOperationsOverviewController } from "./adminOperations.controller.js";

const router = Router();

router.get("/overview", requireAuth, requireAdmin, getOperationsOverviewController);

export { router };
export default router;
