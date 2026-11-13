import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./bankDetails.controller.js";
import { validateBankDetails } from "./bankDetails.validator.js";

const router = Router();

router.put(
  "/bank-details",
  requireAuth,
  validateBankDetails,
  controller.saveBankDetails,
);

router.get("/bank-details", requireAuth, controller.getBankDetails);

export { router };
export default router;
