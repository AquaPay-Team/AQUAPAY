import { createAdmin } from "./admin.service.js";
import { getPasswordConfig } from "../../config/auth.js";
import {
  normalizeMobile,
  isValidMobile,
} from "../../utils/validationHelper.js";

function validateAdminInput(req, res, next) {
  const { name, email, mobile, companyName, password } = req.body || {};

  if (!name || !email || !mobile || !companyName || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
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
      message: "All fields must be strings",
    });
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({
      success: false,
      message: "Invalid email address",
    });
  }

  const normalizedMobile = normalizeMobile(mobile);

  if (!isValidMobile(normalizedMobile)) {
    return res.status(400).json({
      success: false,
      message: "Invalid mobile number",
    });
  }

  // Use the centralized password configuration.
  const passwordConfig = getPasswordConfig();

  if (password.length < passwordConfig.passwordMinLength) {
    return res.status(400).json({
      success: false,
      message: `Password must be at least ${passwordConfig.passwordMinLength} characters`,
    });
  }

  // bcrypt supports a maximum of 72 UTF-8 bytes.
  if (Buffer.byteLength(password, "utf8") > 72) {
    return res.status(400).json({
      success: false,
      message: "Password must not exceed 72 bytes",
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
      message: "Invalid name or company name length",
    });
  }

  req.adminInput = {
    name: name.trim(),
    email: email.trim().toLowerCase(),
    mobile: normalizedMobile,
    companyName: companyName.trim(),
    password,
  };

  next();
}

async function createAdminController(req, res, next) {
  try {
    const admin = await createAdmin(req.adminInput);

    return res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: admin,
    });
  } catch (error) {
    next(error);
  }
}

export { validateAdminInput, createAdminController };

const adminController = {
  validateAdminInput,
  createAdminController,
};

export default adminController;
