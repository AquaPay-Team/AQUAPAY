
import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import controller from "./update-user.controller.js";

const router = Router();

router.patch("/:id", requireAuth, controller.updateUser);

export default router;
