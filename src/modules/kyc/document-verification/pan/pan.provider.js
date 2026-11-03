import { assertDigiLockerSignaturePolicy } from "../digilocker/digilocker.signatureConfig.js";
import { createDigilockerMockProvider } from "../digilocker/digilocker.mockProvider.js";
import { createIdtoHttpClient } from "../shared/idtoHttpClient.js";

const PAN_ENDPOINTS = Object.freeze({
  issuedDocs: "/verify/digilocker/issued_docs",
  getIssuedDocsXml: "/verify/digilocker/get_issued_docs_xml",
});

function createRealPanDocumentProvider(options = {}) {
  const client = createIdtoHttpClient(options);
  return Object.freeze({
    mode: "idto",
    getIssuedDocs: (body, clientOptions = {}) => client.postJson(
      PAN_ENDPOINTS.issuedDocs,
      body,
      { ...clientOptions, expectedFields: ["status", "issued_docs"] },
    ),
    getIssuedDocsXml: (body, clientOptions = {}) => client.postXml(
      PAN_ENDPOINTS.getIssuedDocsXml,
      body,
      clientOptions,
    ),
  });
}

function createPanDocumentProvider(options = {}) {
  const env = options.env || process.env;
  const mode = env.IDTO_PROVIDER_MODE?.trim() || "idto";
  assertDigiLockerSignaturePolicy(env);
  if (mode === "mock") {
    if (!["development", "test"].includes(env.NODE_ENV)) {
      const error = new Error("IDTO mock mode is unavailable outside development and test");
      error.code = "IDTO_MOCK_MODE_FORBIDDEN";
      throw error;
    }
    const mock = createDigilockerMockProvider({ env });
    return Object.freeze({
      mode: "mock",
      getIssuedDocs: mock.getIssuedDocs,
      getIssuedDocsXml: mock.getIssuedDocsXml,
    });
  }
  if (mode !== "idto") {
    const error = new Error("IDTO provider mode is invalid");
    error.code = "IDTO_INVALID_PROVIDER_MODE";
    throw error;
  }
  return createRealPanDocumentProvider(options);
}

const defaultPanProvider = createPanDocumentProvider();

export { createPanDocumentProvider, createRealPanDocumentProvider, PAN_ENDPOINTS };
export default defaultPanProvider;
