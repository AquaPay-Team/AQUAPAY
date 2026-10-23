import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import { validateBasicDetails } from "./basicDetails.validator.js";
import * as controller from "./basicDetails.controller.js";

const router = Router();

router.put(
  "/basic-details",
  requireAuth,
  validateBasicDetails,
  controller.saveBasicDetails,
);

export { router };
export default router;
