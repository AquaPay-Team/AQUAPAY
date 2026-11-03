import { createDigilockerMockProvider } from "./digilocker.mockProvider.js";
import { assertDigiLockerSignaturePolicy } from "./digilocker.signatureConfig.js";

const REQUEST_TIMEOUT_MS = 15000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const ENDPOINTS = Object.freeze({
  initiateSession: "/verify/digilocker/initiate_session",
  getReference: "/verify/digilocker/get_reference",
  userDetails: "/verify/digilocker/user_details",
  fetchAadhaar: "/verify/digilocker/fetch_aadhaar",
  issuedDocs: "/verify/digilocker/issued_docs",
  getIssuedDocs: "/verify/digilocker/get_issued_docs",
  getIssuedDocsXml: "/verify/digilocker/get_issued_docs_xml",
  docMaster: "/verify/digilocker/doc_master",
});

class IdtoProviderError extends Error {
  constructor(code, statusCode, { cause, responseMetadata } = {}) {
    super("DigiLocker provider request failed");
    this.name = "IdtoProviderError";
    this.code = code;
    if (Number.isInteger(statusCode)) this.statusCode = statusCode;
    if (cause !== undefined) this.cause = cause;
    if (responseMetadata) this.responseMetadata = responseMetadata;
  }
}

function getConfig(env = process.env) {
  const baseUrl = env.IDTO_BASE_URL?.trim();
  const clientId = env.IDTO_CLIENT_ID?.trim();
  const apiKey = env.IDTO_API_KEY?.trim();

  if (!baseUrl || !clientId || !apiKey) {
    throw new IdtoProviderError("IDTO_CONFIGURATION_ERROR");
  }

  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new IdtoProviderError("IDTO_CONFIGURATION_ERROR");
  }

  if (
    url.protocol !== "https:" ||
    (url.pathname !== "/" && url.pathname !== "") ||
    Boolean(url.port) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (env.NODE_ENV === "production" && url.hostname !== "prod.idto.ai")
  ) {
    throw new IdtoProviderError("IDTO_CONFIGURATION_ERROR");
  }

  return {
    baseUrl: url.toString().replace(/\/$/, ""),
    clientId,
    apiKey,
  };
}

async function readBodyLimited(response, maxBytes) {
  const announcedLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(announcedLength) && announcedLength > maxBytes) {
    throw new IdtoProviderError("IDTO_RESPONSE_TOO_LARGE", response.status);
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => {});
        throw new IdtoProviderError("IDTO_RESPONSE_TOO_LARGE", response.status);
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  return Buffer.concat(chunks, totalBytes).toString("utf8");
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

function getResponseMetadata({ response, rawBody, expectedFields = [], providerErrorCode = null, parseFailed = false }) {
  const contentType = safeMediaType(response);
  const jsonContentType = contentType === "application/json" || Boolean(contentType?.endsWith("+json"));
  let parsed;
  let responseFormat;

  if (rawBody === null) {
    responseFormat = "unavailable";
  } else if (rawBody.length === 0) {
    responseFormat = "empty";
  } else if (jsonContentType) {
    if (parseFailed) responseFormat = "invalid_json";
    else {
      try {
        parsed = JSON.parse(rawBody);
        responseFormat = "json";
      } catch {
        responseFormat = "invalid_json";
      }
    }
  } else if (contentType?.includes("xml")) {
    responseFormat = "xml";
  } else if (contentType?.startsWith("text/")) {
    responseFormat = "text";
  } else {
    responseFormat = "unknown";
  }

  const isRecord = parsed !== null && typeof parsed === "object" && !Array.isArray(parsed);
  const keys = isRecord ? Object.keys(parsed) : [];
  const topLevelPropertyNames = keys.slice(0, 50).map((key) =>
    /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) ? key : "[nonstandard-key]",
  );
  const topLevelValueTypes = {};
  if (isRecord) {
    for (const key of keys.slice(0, 50)) {
      const safeKey = /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(key) ? key : "[nonstandard-key]";
      topLevelValueTypes[safeKey] = valueType(parsed[key]);
    }
  }
  const expectedFieldSummary = {};
  for (const field of expectedFields) {
    const present = isRecord && Object.hasOwn(parsed, field);
    expectedFieldSummary[field] = {
      present,
      type: present ? valueType(parsed[field]) : "missing",
    };
  }

  return {
    httpStatus: response.status,
    contentType,
    responseFormat,
    jsonRootType: responseFormat === "json" ? valueType(parsed) : null,
    topLevelPropertyNames,
    topLevelValueTypes,
    expectedFields: expectedFieldSummary,
    providerErrorCode,
  };
}

function reportResponseMetadata(observer, metadata) {
  if (typeof observer !== "function") return;
  try {
    observer(metadata);
  } catch {
    // Diagnostics must never alter provider request handling.
  }
}

function createRealDigilockerProvider({
  fetchImpl = globalThis.fetch,
  env = process.env,
  timeoutMs = REQUEST_TIMEOUT_MS,
  maxResponseBytes = MAX_RESPONSE_BYTES,
} = {}) {
  async function request({ endpoint, method = "POST", body, responseType = "json", onResponseMeta, expectedFields = [] }) {
    if (!Object.values(ENDPOINTS).includes(endpoint)) {
      throw new IdtoProviderError("IDTO_INVALID_ENDPOINT");
    }
    if (!fetchImpl) throw new IdtoProviderError("IDTO_CONFIGURATION_ERROR");

    const config = getConfig(env);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const headers = {
      "X-Client-ID": config.clientId,
      "X-API-KEY": config.apiKey,
      Accept: responseType === "xml" ? "application/xml, text/xml" : "application/json",
    };
    const options = {
      method,
      headers,
      signal: controller.signal,
      redirect: "error",
    };

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    try {
      const response = await fetchImpl(`${config.baseUrl}${endpoint}`, options);
      const contentType = safeMediaType(response);
      if (!response.ok) {
        let rawBody = null;
        if (onResponseMeta) {
          try {
            rawBody = await readBodyLimited(response, maxResponseBytes);
          } catch {
            rawBody = null;
          }
        }
        const responseMetadata = getResponseMetadata({
          response,
          rawBody,
          expectedFields,
          providerErrorCode: "IDTO_HTTP_ERROR",
        });
        reportResponseMetadata(onResponseMeta, responseMetadata);
        throw new IdtoProviderError("IDTO_HTTP_ERROR", response.status, { responseMetadata });
      }

      if (responseType === "xml") {
        if (!/^(application|text)\/xml(?:\s*;|$)/.test(contentType)) {
          let rawBody = null;
          if (onResponseMeta) {
            try {
              rawBody = await readBodyLimited(response, maxResponseBytes);
            } catch {
              rawBody = null;
            }
          }
          const responseMetadata = getResponseMetadata({
            response,
            rawBody,
            expectedFields,
            providerErrorCode: "IDTO_INVALID_RESPONSE",
          });
          reportResponseMetadata(onResponseMeta, responseMetadata);
          throw new IdtoProviderError("IDTO_INVALID_RESPONSE", response.status, { responseMetadata });
        }
        const rawBody = await readBodyLimited(response, maxResponseBytes);
        const responseMetadata = getResponseMetadata({ response, rawBody, expectedFields });
        reportResponseMetadata(onResponseMeta, responseMetadata);
        return rawBody;
      }

      if (!contentType?.includes("application/json")) {
        let rawBody = null;
        if (onResponseMeta) {
          try {
            rawBody = await readBodyLimited(response, maxResponseBytes);
          } catch {
            rawBody = null;
          }
        }
        const responseMetadata = getResponseMetadata({
          response,
          rawBody,
          expectedFields,
          providerErrorCode: "IDTO_INVALID_RESPONSE",
        });
        reportResponseMetadata(onResponseMeta, responseMetadata);
        throw new IdtoProviderError("IDTO_INVALID_RESPONSE", response.status, { responseMetadata });
      }

      const rawBody = await readBodyLimited(response, maxResponseBytes);
      let parsedBody;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch {
        const responseMetadata = getResponseMetadata({
          response,
          rawBody,
          expectedFields,
          providerErrorCode: "IDTO_INVALID_RESPONSE",
          parseFailed: true,
        });
        reportResponseMetadata(onResponseMeta, responseMetadata);
        throw new IdtoProviderError("IDTO_INVALID_RESPONSE", response.status, { responseMetadata });
      }
      const responseMetadata = getResponseMetadata({ response, rawBody, expectedFields });
      reportResponseMetadata(onResponseMeta, responseMetadata);
      return parsedBody;
    } catch (error) {
      if (error instanceof IdtoProviderError) throw error;
      if (error?.name === "AbortError") {
        throw new IdtoProviderError("IDTO_TIMEOUT", undefined, { cause: error });
      }
      throw new IdtoProviderError("IDTO_NETWORK_ERROR", undefined, { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    mode: "idto",
    request,
    initiateSession: (body) => request({ endpoint: ENDPOINTS.initiateSession, body }),
    getReference: (body, options = {}) => request({
      endpoint: ENDPOINTS.getReference,
      body,
      onResponseMeta: options.onResponseMeta,
      expectedFields: ["reference_key"],
    }),
    getUserDetails: (body, options = {}) => request({
      endpoint: ENDPOINTS.userDetails,
      body,
      onResponseMeta: options.onResponseMeta,
      expectedFields: ["status", "user"],
    }),
    fetchAadhaar: (body, options = {}) => request({
      endpoint: ENDPOINTS.fetchAadhaar,
      body,
      responseType: "xml",
      onResponseMeta: options.onResponseMeta,
    }),
    getIssuedDocs: (body, options = {}) => request({
      endpoint: ENDPOINTS.issuedDocs,
      body,
      onResponseMeta: options.onResponseMeta,
      expectedFields: ["status", "issued_docs"],
    }),
    getIssuedDoc: (body) => request({ endpoint: ENDPOINTS.getIssuedDocs, body }),
    getIssuedDocsXml: (body, options = {}) => request({
      endpoint: ENDPOINTS.getIssuedDocsXml,
      body,
      responseType: "xml",
      onResponseMeta: options.onResponseMeta,
    }),
    getDocumentMaster: () => request({
      endpoint: ENDPOINTS.docMaster,
      method: "GET",
    }),
  };
}

function createDigilockerProvider(options = {}) {
  const env = options.env || process.env;
  const mode = env.IDTO_PROVIDER_MODE?.trim() || "idto";
  assertDigiLockerSignaturePolicy(env);

  if (mode === "mock") {
    if (!["development", "test"].includes(env.NODE_ENV)) {
      throw new IdtoProviderError("IDTO_MOCK_MODE_FORBIDDEN");
    }
    return createDigilockerMockProvider({ env });
  }

  if (mode !== "idto") {
    throw new IdtoProviderError("IDTO_INVALID_PROVIDER_MODE");
  }
  return createRealDigilockerProvider(options);
}

const defaultProvider = createDigilockerProvider();

export {
  createDigilockerProvider,
  createRealDigilockerProvider,
  IdtoProviderError,
  ENDPOINTS,
};
export const request = defaultProvider.request;
export default defaultProvider;
