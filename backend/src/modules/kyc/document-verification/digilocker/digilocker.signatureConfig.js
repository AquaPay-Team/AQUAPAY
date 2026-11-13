const TRUE_VALUES = new Set(["true"]);
const FALSE_VALUES = new Set(["", "false"]);

function getDigiLockerSignaturePolicy(env = process.env) {
  const configuredValue = String(env.IDTO_SKIP_XML_SIGNATURE_VERIFICATION ?? "")
    .trim()
    .toLowerCase();

  if (FALSE_VALUES.has(configuredValue)) {
    return Object.freeze({
      signatureVerified: true,
      developmentOnly: false,
      mode: "issuer_certificate",
    });
  }
  if (!TRUE_VALUES.has(configuredValue)) {
    throw new Error("IDTO_SKIP_XML_SIGNATURE_VERIFICATION must be true or false");
  }

  if (env.NODE_ENV !== "development") {
    throw new Error("IDTO XML signature bypass is allowed only in NODE_ENV=development");
  }
  if ((env.IDTO_PROVIDER_MODE?.trim() || "idto") !== "idto") {
    throw new Error("IDTO XML signature bypass requires the real IDTO provider");
  }
  if (env.IDTO_DEV_UNVERIFIED_DATABASE?.trim().toLowerCase() !== "true") {
    throw new Error("IDTO XML signature bypass requires an isolated local development database opt-in");
  }

  const dbHost = env.DB_HOST?.trim().toLowerCase();
  if (!new Set(["localhost", "127.0.0.1", "::1", "[::1]"]).has(dbHost)) {
    throw new Error("IDTO XML signature bypass requires a loopback database host");
  }
  if (!/^[A-Za-z0-9_]+$/.test(env.DB_NAME || "")) {
    throw new Error("IDTO XML signature bypass requires a configured local database name");
  }

  return Object.freeze({
    signatureVerified: false,
    developmentOnly: true,
    mode: "development_unverified",
  });
}

function assertDigiLockerSignaturePolicy(env = process.env) {
  return getDigiLockerSignaturePolicy(env);
}

export { assertDigiLockerSignaturePolicy, getDigiLockerSignaturePolicy };
