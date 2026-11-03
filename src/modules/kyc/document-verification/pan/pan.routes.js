import { Router } from "express";
import { requireAuth } from "../../../../middlewares/auth.middleware.js";
import { validateConsentRequest } from "../digilocker/digilocker.validator.js";
import panController from "./pan.controller.js";

const router = Router();

router.post(
  "/digilocker/pan/initiate",
  requireAuth,
  validateConsentRequest,
  panController.initiateVerification,
);

export { router };
export default router;
