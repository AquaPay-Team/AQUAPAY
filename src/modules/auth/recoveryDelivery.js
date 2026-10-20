function isConfigured() {
  return false;
}

async function sendPasswordReset() {
  throw new Error("No approved password recovery provider is configured");
}

async function sendPasswordChanged() {
  throw new Error("No approved password recovery provider is configured");
}

export {
  isConfigured,
  sendPasswordReset,
  sendPasswordChanged,
};

export default {
  isConfigured,
  sendPasswordReset,
  sendPasswordChanged,
};
