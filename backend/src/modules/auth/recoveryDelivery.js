function providerConfig(type) {
  if (type !== "email" && type !== "mobile") return null;
  const prefix = type === "email" ? "AUTH_RECOVERY_EMAIL" : "AUTH_RECOVERY_SMS";
  const endpoint = process.env[`${prefix}_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  if (!endpoint || !apiKey) return null;

  let url;
  try {
    url = new URL(endpoint);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && !(url.hostname === "localhost" && url.protocol === "http:")) {
    return null;
  }
  return { endpoint: url.toString(), apiKey };
}

function validBaseUrl() {
  try {
    const url = new URL(process.env.AUTH_RECOVERY_BASE_URL);
    return url.protocol === "https:" || (url.protocol === "http:" && url.hostname === "localhost");
  } catch {
    return false;
  }
}

function isConfigured(type) {
  if (type) return Boolean(providerConfig(type) && validBaseUrl());
  return Boolean((providerConfig("email") || providerConfig("mobile")) && validBaseUrl());
}

async function send(type, payload) {
  const config = providerConfig(type);
  if (!config) throw new Error(`Password recovery ${type} provider is not configured`);
  const response = await fetch(config.endpoint, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) {
    throw new Error(`Password recovery ${type} provider returned HTTP ${response.status}`);
  }
}

async function sendPasswordReset({ destination, type, token, otp }) {
  if (process.env.NODE_ENV === "development") {
    console.info(`[AquaPay DEVELOPMENT OTP] ${otp}`);
    return;
  }
  if (!isConfigured(type)) throw new Error("Password recovery delivery is not configured");

  const resetUrl = new URL("/reset-password", process.env.AUTH_RECOVERY_BASE_URL);
  resetUrl.searchParams.set("token", token);
  const message = type === "email"
    ? {
        to: destination,
        subject: "Reset your AquaPay password",
        text: `Reset link: ${resetUrl}\nVerification code: ${otp}`,
      }
    : { to: destination, message: `Reset link: ${resetUrl}\nVerification code: ${otp}` };
  await send(type, message);
}

async function sendPasswordChanged(account) {
  const type = providerConfig("email") ? "email" : "mobile";
  if (!isConfigured(type)) return;
  const destination = type === "email" ? account.email : account.mobile;
  const message = type === "email"
    ? {
        to: destination,
        subject: "Your AquaPay password was changed",
        text: "Your AquaPay password was changed. If this was not you, contact support.",
      }
    : {
        to: destination,
        message: "Your AquaPay password was changed. If this was not you, contact support.",
      };
  await send(type, message);
}

export { isConfigured, sendPasswordReset, sendPasswordChanged };

export default { isConfigured, sendPasswordReset, sendPasswordChanged };
