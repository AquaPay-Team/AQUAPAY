

import { ApiError } from "../../utils/ApiError.js";

function verifyAdminSetupKey(req, res, next) {
  const setupKey = process.env.ADMIN_SETUP_KEY;
  const providedKey = req.get("x-admin-setup-key");

  if (!setupKey) {
    // Missing server configuration – forward as ApiError so the global error handler can mask details.
    return next(new ApiError(500, "Admin setup is not configured"));
  }

  if (!providedKey || providedKey !== setupKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid or missing setup key"
    });
  }

  next();
}

export { verifyAdminSetupKey };

export default { verifyAdminSetupKey };
