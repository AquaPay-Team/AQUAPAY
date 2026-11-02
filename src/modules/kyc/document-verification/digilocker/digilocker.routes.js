import { Router } from "express";
import digilockerController from "./digilocker.controller.js";
import digilockerProvider from "./digilocker.provider.js";
import { validateCallbackRequest } from "./digilocker.validator.js";
import "../aadhaar/aadhaar.service.js";
import "../pan/pan.service.js";

const router = Router();

// DigiLocker redirects here without AquaPay's bearer token. The single-use opaque state
// ties this callback to the authenticated user and verification session created above.
router.get(
  "/digilocker/callback",
  validateCallbackRequest,
  digilockerController.callback,
);

if (digilockerProvider.mode === "mock") {
  router.get("/digilocker/mock-authorize", digilockerController.mockAuthorize);
}

export { router };
export default router;
