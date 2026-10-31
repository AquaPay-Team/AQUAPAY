import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./basicDetails.controller.js";
import {
  validateBasicDetails,
  validateKycOtpRequest,
  validateKycOtp,
} from "./basicDetails.validator.js";

const router = Router();

router.put(
  "/basic-details",
  requireAuth,
  validateBasicDetails,
  controller.saveBasicDetails,
);
router.post(
  "/basic-details/request-otp",
  requireAuth,
  validateKycOtpRequest,
  controller.requestStep1Otp,
);
router.post(
  "/basic-details/verify-otp",
  requireAuth,
  validateKycOtp,
  controller.verifyStep1Otp,
);

export { router };
export default router;
