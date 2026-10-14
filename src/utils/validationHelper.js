function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(value) {
  const email = normalizeString(value).toLowerCase();
  return email || null;
}

function normalizeMobile(value) {
  return normalizeString(String(value ?? ""));
}

function isValidEmail(value) {
  return (
    typeof value === "string" &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
  );
}

function isValidMobile(value) {
  return (
    typeof value === "string" &&
    /^\+?[0-9]{10,15}$/.test(value.trim())
  );
}

module.exports = {
  normalizeString,
  normalizeEmail,
  normalizeMobile,
  isValidEmail,
  isValidMobile,
};

