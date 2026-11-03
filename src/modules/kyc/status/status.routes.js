import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import statusController from "./status.controller.js";

const router = Router();

router.get("/status", requireAuth, statusController.getKycStatus);

export { router };
export default router;
