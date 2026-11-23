import { Router } from "express";
import { requireAuth, requireAdmin } from "../../../middlewares/auth.middleware.js";
import { getAdminUsersController } from "./adminUsers.controller.js";

const router = Router();

router.get("/", requireAuth, requireAdmin, getAdminUsersController);

export { router };
export default router;
