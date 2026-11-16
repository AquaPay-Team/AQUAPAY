import { Router } from "express";
import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { validateConsentRequest } from "../digilocker/digilocker.validator.js";
import aadhaarController from "./aadhaar.controller.js";
import { rateLimit } from "../../../../middlewares/authRateLimit.middleware.js";
const router = Router();

router.post(
  "/digilocker/aadhaar/initiate",
  requireAuth,
  rateLimit("digilockerInitiation"),
  validateConsentRequest,
  aadhaarController.initiateVerification,
);

router.get(
  "/digilocker/aadhaar/status/",
  requireAuth,
  aadhaarController.getVerificationStatus,
);

export { router };
export default router;
