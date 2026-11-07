import { createDigilockerMockProvider } from "./digilocker.mockProvider.js";
import { DigiLockerProviderError } from "./digilocker.errors.js";
import { createIdtoHttpClient } from "../shared/idtoHttpClient.js";

const ENDPOINTS = Object.freeze({
  initiateSession: "/verify/digilocker/initiate_session",
  getReference: "/verify/digilocker/get_reference",
  userDetails: "/verify/digilocker/user_details",
  fetchAadhaar: "/verify/digilocker/fetch_aadhaar",
});

function createRealDigilockerProvider(options = {}) {
  const client = createIdtoHttpClient(options);
  return Object.freeze({
    mode: "idto",
    initiateSession: (body, clientOptions = {}) => client.postJson(
      ENDPOINTS.initiateSession,
      body,
      { ...clientOptions, expectedFields: ["status", "code", "url"] },
    ),
    getReference: (body, clientOptions = {}) => client.postJson(
      ENDPOINTS.getReference,
      body,
      { ...clientOptions, expectedFields: ["reference_key", "expires_at", "chargeble", "user_consent"] },
    ),
    getUserDetails: (body, clientOptions = {}) => client.postJson(
      ENDPOINTS.userDetails,
      body,
      clientOptions,
    ),
    fetchAadhaar: (body, clientOptions = {}) => client.postXml(
      ENDPOINTS.fetchAadhaar,
      body,
      {
        ...clientOptions,
        statusMap: {
          403: "CONSENT_NOT_PROVIDED",
          404: "DOC_NOT_FOUND",
          410: "REFERENCE_KEY_EXPIRED",
          500: "DOC_UNAVAILABLE",
        },
      },
    ),
  });
}

function createMockDigilockerProvider(env) {
  const mock = createDigilockerMockProvider({ env });
  return Object.freeze({
    mode: "mock",
    initiateSession: mock.initiateSession,
    getReference: mock.getReference,
    getUserDetails: mock.getUserDetails,
    fetchAadhaar: mock.fetchAadhaar,
    getMockCallbackParameters: mock.getMockCallbackParameters,
  });
}

function createDigilockerProvider(options = {}) {
  const env = options.env || process.env;
  const mode = env.IDTO_PROVIDER_MODE?.trim() || "idto";
  if (mode === "mock") {
    if (!["development", "test"].includes(env.NODE_ENV)) {
      throw new DigiLockerProviderError("IDTO_MOCK_MODE_FORBIDDEN");
    }
    return createMockDigilockerProvider(env);
  }
  if (mode !== "idto") throw new DigiLockerProviderError("IDTO_INVALID_PROVIDER_MODE");
  return createRealDigilockerProvider(options);
}

const defaultProvider = createDigilockerProvider();

export {
  createDigilockerProvider,
  createRealDigilockerProvider,
  ENDPOINTS,
};
export default defaultProvider;
