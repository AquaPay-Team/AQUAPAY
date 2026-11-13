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

  if (/^\+91[0-9]{10}$/.test(str)) {
    return str;
  }

  if (/^[0-9]{10}$/.test(str)) {
    return `+91${str}`;
  }

  if (/^0[0-9]{10}$/.test(str)) {
    return `+91${str.slice(1)}`;
  }

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
  return /^\+91[6-9][0-9]{9}$/.test(normalized);
}

function isValidShopname(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return value.trim().length <= 150;
}

function isValidStateOrCity(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return value.trim().length <= 100;
}

function isValidAddress(value) {
  if (value === null || value === undefined || value === "") return true;
  if (typeof value !== "string") return false;
  return value.trim().length <= 255;
}

function isValidPincode(value) {
  if (value === null || value === undefined || value === "") return true;
  const str = String(value).trim();
  return /^[1-9][0-9]{5}$/.test(str);
}

function isValidPassword(value) {
  if (typeof value !== "string") return false;
  return value.length >= 8 && Buffer.byteLength(value, "utf8") <= 72;
}

export {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidName,
  isValidEmail,
  isValidMobile,
  isValidShopname,
  isValidStateOrCity,
  isValidAddress,
  isValidPincode,
  isValidPassword,
};

export default {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidName,
  isValidEmail,
  isValidMobile,
  isValidShopname,
  isValidStateOrCity,
  isValidAddress,
  isValidPincode,
  isValidPassword,
};
