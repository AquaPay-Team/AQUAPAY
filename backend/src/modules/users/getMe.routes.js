import { Router } from "express";
import { requireAuth } from "../../middlewares/auth.middleware.js";
import getMeHandler from "./getMe.controller.js";

const router = Router();

// GET /api/users/me – returns basic profile of the authenticated user
router.get("/me", requireAuth, getMeHandler);

export { router };
export default router;
