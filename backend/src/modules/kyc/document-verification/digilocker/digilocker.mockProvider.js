import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FIXTURE_DIRECTORY = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
const MOCK_CODE_VERIFIER = "m".repeat(43);
const MOCK_CALLBACK_CLIENT_ID = "aquapay-local-mock-client";
const MOCK_DOCUMENTS = Object.freeze({
  ADHAR: {
    verificationType: "aadhaar",
    code: "aquapay-mock-adhar-v1",
    referenceKey: "aquapay_mock_reference_adhar_v1",
    fixture: "aadhaar.xml",
  },
});

const MOCK_REFERENCES = new Map(
  Object.values(MOCK_DOCUMENTS).map((document) => [document.referenceKey, document]),
);

function getMockCallbackParameters({ state, document }) {
  if (typeof state !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(state)) {
    throw new Error("Invalid mock authorization state");
  }
  const selectedDocument = MOCK_DOCUMENTS[document];
  if (!selectedDocument) throw new Error("Unsupported mock document");
  return {
    code: selectedDocument.code,
    codeVerifier: MOCK_CODE_VERIFIER,
    clientId: MOCK_CALLBACK_CLIENT_ID,
    state,
  };
}

function getMockBaseUrl(env) {
  const fallbackPort = Number(env.PORT || 3000);
  const configuredBase = env.IDTO_MOCK_BASE_URL?.trim() || `http://127.0.0.1:${fallbackPort}`;
  let baseUrl;
  try {
    baseUrl = new URL(configuredBase);
  } catch {
    throw new Error("Invalid mock provider base URL");
  }
  if (
    baseUrl.protocol !== "http:" ||
    !["localhost", "127.0.0.1", "[::1]"].includes(baseUrl.hostname) ||
    baseUrl.username ||
    baseUrl.password ||
    baseUrl.pathname !== "/" ||
    baseUrl.search ||
    baseUrl.hash
  ) {
    throw new Error("Mock provider must use a local loopback URL");
  }
  return baseUrl.origin;
}

function createDigilockerMockProvider({ env = process.env } = {}) {
  function getDocumentForCode(code) {
    const document = Object.values(MOCK_DOCUMENTS).find((item) => item.code === code);
    if (!document) throw new Error("Invalid mock authorization code");
    return document;
  }

  return {
    mode: "mock",
    initiateSession: async (body) => {
      const documentCode = body?.documents_for_consent?.[0];
      if (
        body?.consent !== true ||
        body?.redirect_to_signup !== false ||
        !Array.isArray(body?.documents_for_consent) ||
        body.documents_for_consent.length !== 1 ||
        !MOCK_DOCUMENTS[documentCode] ||
        typeof body.state !== "string" ||
        !/^[A-Za-z0-9_-]{43}$/.test(body.state)
      ) {
        throw new Error("Invalid mock DigiLocker initiation request");
      }

      const url = new URL("/api/kyc/digilocker/mock-authorize", getMockBaseUrl(env));
      url.searchParams.set("state", body.state);
      url.searchParams.set("document", documentCode);
      return { status: "success", code: 1000, url: url.toString() };
    },
    getReference: async ({ code, code_verifier: codeVerifier } = {}) => {
      if (codeVerifier !== MOCK_CODE_VERIFIER) {
        throw new Error("Invalid mock code verifier");
      }
      const document = getDocumentForCode(code);
      return {
        status: "success",
        reference_key: document.referenceKey,
        expires_at: "2099-01-01T00:00:00.000Z",
      };
    },
    getUserDetails: async ({ reference_key: referenceKey } = {}) => {
      if (!MOCK_REFERENCES.has(referenceKey)) throw new Error("Invalid mock reference key");
      return { status: "success" };
    },
    fetchAadhaar: async ({ reference_key: referenceKey } = {}) => {
      const document = MOCK_REFERENCES.get(referenceKey);
      if (document?.verificationType !== "aadhaar") throw new Error("Aadhaar document is unavailable");
      const fixturePath = path.join(FIXTURE_DIRECTORY, document.fixture);
      try { return fs.readFileSync(fixturePath, "utf8"); }
      catch { throw new Error("Mock DigiLocker Aadhaar XML fixture is not available"); }
    },
    getMockCallbackParameters,
  };
}

export { createDigilockerMockProvider, getMockCallbackParameters };
