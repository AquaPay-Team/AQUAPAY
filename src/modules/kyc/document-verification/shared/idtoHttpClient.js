import { DigiLockerProviderError } from "../digilocker/digilocker.errors.js";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const SAFE_PROVIDER_ERROR_CODES = new Set([
  "IDTO_001",
  "IDTO_004",
  "IDTO_005",
  "IDTO_006",
  "IDTO_007",
  "IDTO_008",
  "IDTO_009",
  "IDTO_202",
]);
const ALLOWED_PATHS = new Set([
  "/verify/digilocker/initiate_session",
  "/verify/digilocker/get_reference",
  "/verify/digilocker/user_details",
  "/verify/digilocker/fetch_aadhaar",
  "/v2/verify/pan_detailed",
]);

function getConfig(env) {
  const baseUrl = env.IDTO_BASE_URL?.trim();
  const clientId = env.IDTO_CLIENT_ID?.trim();
  const apiKey = env.IDTO_API_KEY?.trim();
  if (!baseUrl || !clientId || !apiKey) throw new DigiLockerProviderError("IDTO_CONFIGURATION_ERROR");
  let url;
  try { url = new URL(baseUrl); } catch { throw new DigiLockerProviderError("IDTO_CONFIGURATION_ERROR"); }
  if (
    url.protocol !== "https:" || (url.pathname !== "/" && url.pathname !== "") || url.port ||
    url.username || url.password || url.search || url.hash ||
    (env.NODE_ENV === "production" && url.hostname !== "prod.idto.ai")
  ) throw new DigiLockerProviderError("IDTO_CONFIGURATION_ERROR");
  return { baseUrl: url.toString().replace(/\/$/, ""), clientId, apiKey };
}

async function readBodyLimited(response, maxBytes) {
  const announcedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > maxBytes) {
    await response.body?.cancel().catch(() => {});
    throw new DigiLockerProviderError("IDTO_RESPONSE_TOO_LARGE", response.status);
  }
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new DigiLockerProviderError("IDTO_RESPONSE_TOO_LARGE", response.status);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size).toString("utf8");
}

function safeMediaType(response) {
  const value = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() || "";
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(value) ? value : null;
}

function valueType(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function responseMetadata(response, rawBody, expectedFields) {
  const contentType = safeMediaType(response);
  let parsed;
  let responseFormat = rawBody.length === 0 ? "empty" : "unknown";
  if (contentType === "application/json" || contentType?.endsWith("+json")) {
    try { parsed = JSON.parse(rawBody); responseFormat = "json"; }
    catch { responseFormat = "invalid_json"; }
  } else if (contentType?.includes("xml")) responseFormat = "xml";
  else if (contentType?.startsWith("text/")) responseFormat = "text";
  const record = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  const keys = record ? Object.keys(parsed) : [];
  const names = keys.slice(0, 40).map((key) => /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) ? key : "[invalid-key]");
  const valueTypes = {};
  if (record) keys.slice(0, 40).forEach((key, index) => { valueTypes[names[index]] = valueType(parsed[key]); });
  const expected = {};
  for (const key of expectedFields) {
    const present = record && Object.hasOwn(parsed, key);
    expected[key] = { present, type: present ? valueType(parsed[key]) : "missing" };
  }
  const providerErrorCandidate = record
    ? (parsed.error_code ?? parsed.code)
    : undefined;
  const providerErrorCode = typeof providerErrorCandidate === "string" &&
    SAFE_PROVIDER_ERROR_CODES.has(providerErrorCandidate)
    ? providerErrorCandidate
    : null;
  return {
    httpStatus: response.status,
    contentType,
    responseFormat,
    contentLengthBytes: Buffer.byteLength(rawBody, "utf8"),
    topLevelPropertyNames: names,
    topLevelValueTypes: valueTypes,
    expectedFields: expected,
    providerErrorCode,
  };
}

function reportMetadata(observer, metadata) {
  if (typeof observer !== "function") return;
  try { observer(metadata); } catch { /* Metadata callbacks cannot affect provider behavior. */ }
}

function createIdtoHttpClient({
  fetchImpl = globalThis.fetch,
  env = process.env,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxResponseBytes = MAX_RESPONSE_BYTES,
} = {}) {
  async function request({
    endpoint,
    body,
    responseType = "json",
    onResponseMeta,
    expectedFields = [],
    statusMap = {},
  }) {
    if (!ALLOWED_PATHS.has(endpoint) || typeof fetchImpl !== "function") {
      throw new DigiLockerProviderError("IDTO_CONFIGURATION_ERROR");
    }
    const config = getConfig(env);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "X-Client-ID": config.clientId,
      "X-API-KEY": config.apiKey,
      Accept: responseType === "xml" ? "application/xml, text/xml" : "application/json",
      "Content-Type": "application/json",
    };
    try {
      const response = await fetchImpl(`${config.baseUrl}${endpoint}`, {
        method: "POST",
        headers,
        signal: controller.signal,
        redirect: "error",
        body: JSON.stringify(body),
      });
      const rawBody = await readBodyLimited(response, maxResponseBytes);
      const metadata = responseMetadata(response, rawBody, expectedFields);
      reportMetadata(onResponseMeta, metadata);
      if (!response.ok) {
        throw new DigiLockerProviderError(statusMap[response.status] || "IDTO_HTTP_ERROR", response.status, metadata);
      }
      if (responseType === "xml") {
        if (metadata.contentType !== "application/xml" && metadata.contentType !== "text/xml") {
          throw new DigiLockerProviderError("IDTO_AADHAAR_UNEXPECTED_JSON_RESPONSE", response.status, metadata);
        }
        if (!rawBody.trim()) throw new DigiLockerProviderError("IDTO_INVALID_RESPONSE", response.status, metadata);
        return rawBody;
      }
      if (!(metadata.contentType === "application/json" || metadata.contentType?.endsWith("+json"))) {
        throw new DigiLockerProviderError("IDTO_INVALID_RESPONSE", response.status, metadata);
      }
      try { return JSON.parse(rawBody); }
      catch { throw new DigiLockerProviderError("IDTO_INVALID_RESPONSE", response.status, metadata); }
    } catch (error) {
      if (error instanceof DigiLockerProviderError) throw error;
      if (error?.name === "AbortError") throw new DigiLockerProviderError("IDTO_TIMEOUT", undefined, undefined, error);
      throw new DigiLockerProviderError("IDTO_NETWORK_ERROR", undefined, undefined, error);
    } finally {
      clearTimeout(timeout);
    }
  }

  return Object.freeze({
    postJson: (endpoint, body, options = {}) => request({ endpoint, body, ...options, responseType: "json" }),
    postXml: (endpoint, body, options = {}) => request({ endpoint, body, ...options, responseType: "xml" }),
  });
}

export { createIdtoHttpClient };
