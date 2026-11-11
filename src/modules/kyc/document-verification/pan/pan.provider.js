import { createIdtoHttpClient } from "../shared/idtoHttpClient.js";

const PAN_ENDPOINTS = Object.freeze({
  panDetailed: "/v2/verify/pan_detailed",
});

function createRealPanDocumentProvider(options = {}) {
  const client = createIdtoHttpClient(options);
  return Object.freeze({
    mode: "idto",
    providerName: "idto_pan_detailed_v2",
    verifyPanDetailed: (body, clientOptions = {}) =>
      client.postJson(PAN_ENDPOINTS.panDetailed, body, {
        ...clientOptions,
        expectedFields: ["status", "error_code", "data"],
      }),
  });
}

function createMockPanDetailedProvider({ env = process.env } = {}) {
  if (!["development", "test"].includes(env.NODE_ENV)) {
    const error = new Error("IDTO mock mode is unavailable outside development and test");
    error.code = "IDTO_MOCK_MODE_FORBIDDEN";
    throw error;
  }
  return Object.freeze({
    mode: "mock",
    providerName: "idto_pan_detailed_v2_mock",
    async verifyPanDetailed(body) {
      if (
        !body ||
        typeof body.pan_number !== "string" ||
        !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(body.pan_number) ||
        body.user_consent !== true ||
        typeof body.name !== "string" ||
        !body.name.trim()
      ) {
        const error = new Error("Invalid local PAN mock request");
        error.code = "PAN_MOCK_INVALID_REQUEST";
        throw error;
      }
      return {
        status: "success",
        error_code: null,
        data: {
          pan_number: body.pan_number,
          full_name: body.name,
        },
      };
    },
  });
}

function createPanDocumentProvider(options = {}) {
  const env = options.env || process.env;
  const mode = env.IDTO_PROVIDER_MODE?.trim() || "idto";
  if (mode === "mock") return createMockPanDetailedProvider({ env });
  if (mode !== "idto") {
    const error = new Error("IDTO provider mode is invalid");
    error.code = "IDTO_INVALID_PROVIDER_MODE";
    throw error;
  }
  return createRealPanDocumentProvider(options);
}

const defaultPanProvider = createPanDocumentProvider();

export {
  createMockPanDetailedProvider,
  createPanDocumentProvider,
  createRealPanDocumentProvider,
  PAN_ENDPOINTS,
};
export default defaultPanProvider;
