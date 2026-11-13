import { Router } from "express";
import { requireAuth } from "../../../middlewares/auth.middleware.js";
import * as controller from "./media.controller.js";
import { uploadSingleMedia } from "./mediaUpload.middleware.js";
import { validateMediaUpload } from "./media.validator.js";

const router = Router();

router.post(
  "/media/upload",
  requireAuth,
  uploadSingleMedia,
  validateMediaUpload,
  controller.uploadKycMedia,
);

export { router };
export default router;
