import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./agreement.controller.js";
import { validateAcceptAgreement } from "./agreement.validator.js";

const router = Router();

router.get("/agreement", requireAuth, controller.getAgreementDetails);

router.post(
  "/agreement/accept",
  requireAuth,
  validateAcceptAgreement,
  controller.acceptAgreement,
);

export { router };
export default router;

