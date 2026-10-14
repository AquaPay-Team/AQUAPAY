const { createAdmin } = require("./admin.service");
function validateAdminInput(req, res, next) {
  const { name, email, mobile, companyName, password } = req.body;

  if (!name || !email || !mobile || !companyName || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required"
    });
  }

  if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof mobile !== "string" ||
    typeof companyName !== "string" ||
    typeof password !== "string"
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields must be strings"
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid email address"
    });
  }

  if (!/^[6-9]\d{9}$/.test(mobile.trim())) {
  return res.status(400).json({
    success: false,
    message: "Invalid mobile number"
  });
}

  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 8 characters"
    });
  }
  if (
  !name.trim() ||
  name.trim().length > 100 ||
  !companyName.trim() ||
  companyName.trim().length > 150
) {
  return res.status(400).json({
    success: false,
    message: "Invalid name or company name length"
  });
}

  req.adminInput = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    mobile: mobile.trim(),
    companyName: companyName.trim(),
    password
  };

  next();
}

// module.exports = { validateAdminInput };
async function createAdminController(req, res, next) {
  try {
    const admin = await createAdmin(req.adminInput);

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: admin
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  validateAdminInput,
  createAdminController
};
