import { Router } from "express";
import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import panController from "./pan.controller.js";
import { validatePanVerificationRequest } from "./pan.validator.js";
import { rateLimit } from "../../../../middlewares/authRateLimit.middleware.js";

const router = Router();

router.post(
  "/pan/verify",
  requireAuth,
  rateLimit("panVerification"),
  validatePanVerificationRequest,
  panController.verifyPan,
);
export { router };
export default router;
