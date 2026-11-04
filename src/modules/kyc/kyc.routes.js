import { Router } from "express";

import basicDetailsRoutes from "./basic-details/basicDetails.routes.js";
import statusRoutes from "./status/status.routes.js";

import digilockerRoutes from "./document-verification/digilocker/digilocker.routes.js";
import aadhaarRoutes from "./document-verification/aadhaar/aadhaar.routes.js";
import panRoutes from "./document-verification/pan/pan.routes.js";

import bankDetailsRoutes from "./bank-details/bankDetails.routes.js";
import mediaRoutes from "./media/media.routes.js";

const router = Router();

router.use(basicDetailsRoutes);
router.use(statusRoutes);

router.use(digilockerRoutes);
router.use(aadhaarRoutes);
router.use(panRoutes);

router.use(bankDetailsRoutes);
router.use(mediaRoutes);

export { router };
export default router;
