import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./submission.controller.js";
import { validateSubmitKyc } from "./submission.validator.js";

const router = Router();

router.get("/submit", requireAuth, controller.getSubmissionStatus);
router.get("/submission-status", requireAuth, controller.getSubmissionStatus);

router.post(
  "/submit",
  requireAuth,
  validateSubmitKyc,
  controller.submitKycApplication,
);

export { router };
export default router;

