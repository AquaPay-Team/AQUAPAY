import adminSetupMiddleware from "./adminSetup.middleware.js";
import { Router } from "express";
import { validateAdminInput, createAdminController } from "./admin.controller.js";

const router = Router();

router.post(
  "/create",
  adminSetupMiddleware.verifyAdminSetupKey,
  validateAdminInput,
  createAdminController
);

export { router };
export default router;
