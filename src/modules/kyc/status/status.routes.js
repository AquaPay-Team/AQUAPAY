import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./status.controller.js";

const router = Router();

router.get("/status", requireAuth, controller.getStatus);

export { router };
export default router;
