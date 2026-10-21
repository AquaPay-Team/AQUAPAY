function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  const email = normalizeString(value).toLowerCase();
  return email || null;
}

function normalizeMobile(value) {
  if (value === null || value === undefined) return "";
  let str = String(value).trim().replace(/[\s-]/g, "");

  // Auto-fill +91 if user provides 10 digits
  if (/^[0-9]{10}$/.test(str)) {
    return `+91${str}`;
  }

  // If user provides 91 followed by 10 digits without '+'
  if (/^91[0-9]{10}$/.test(str)) {
    return `+${str}`;
  }
 
  return str;
}

function isValidName(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length < 2 || trimmed.length > 100) return false;
  return /^[a-zA-Z\s]+$/.test(trimmed);
}

function isValidEmail(value) {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  return trimmed.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function isValidMobile(value) {
  if (value === null || value === undefined) return false;
  const normalized = normalizeMobile(value);
  // Must be +91 followed by exactly 10 digits
  return /^\+91[0-9]{10}$/.test(normalized);
}

function isValidStateOrCity(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return value.trim().length <= 100;
}

function isValidPassword(value) {
  if (typeof value !== "string") return false;
  return value.length >= 8 && value.length <= 128;
}

export {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidName,
  isValidEmail,
  isValidMobile,
  isValidStateOrCity,
  isValidPassword
};

export default {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidName,
  isValidEmail,
  isValidMobile,
  isValidStateOrCity,
  isValidPassword
};
