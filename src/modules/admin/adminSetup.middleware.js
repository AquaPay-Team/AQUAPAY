

function verifyAdminSetupKey(req, res, next) {
  const setupKey = process.env.ADMIN_SETUP_KEY;
  const providedKey = req.get("x-admin-setup-key");

  if (!setupKey) {
    return res.status(500).json({
      success: false,
      message: "Admin setup is not configured"
    });
  }

  if (!providedKey || providedKey !== setupKey) {
    return res.status(401).json({
      success: false,
      message: "Invalid or missing setup key"
    });
  }

  next();
}

module.exports = { verifyAdminSetupKey };
