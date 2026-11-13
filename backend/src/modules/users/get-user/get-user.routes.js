import { Router } from "express";
import * as controller from "./get-user.controllers.js";
import { requireAuth } from "../../../middlewares/auth.middleware.js";

const router = Router();

router.get("/", requireAuth, controller.getUsers);
router.get("/:id", requireAuth, controller.getUserById);

export { router };
export default router;