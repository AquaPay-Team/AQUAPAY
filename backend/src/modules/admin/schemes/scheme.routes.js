import { Router } from "express";
import { requireAuth, requireAdmin } from "../../../middlewares/auth.middleware.js";
import schemeController from "./scheme.controller.js";

const router = Router();

// Scheme Manager is restricted to authenticated Admin accounts.
router.use(requireAuth, requireAdmin);

router.get("/", schemeController.getSchemesController);
router.post("/", schemeController.createSchemeController);
router.patch("/:schemeId/status", schemeController.updateSchemeStatusController);

export { router };
export default router;
