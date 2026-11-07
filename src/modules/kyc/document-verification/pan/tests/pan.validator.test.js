import test from "node:test";
import assert from "node:assert/strict";

import {
  validatePanDetailedResponse,
  validatePanVerificationInput,
} from "../pan.validator.js";

const VALID_RESPONSE = {
  status: "success",
  error_code: null,
  data: {
    full_name: "Rahul Kumar Sharma",
    pan_number: "ABCDE1234F",
    dob: "1998-05-20",
  },
};

test("accepts a valid PAN Detailed v2 response", () => {
  const result = validatePanDetailedResponse(VALID_RESPONSE);

  assert.deepEqual(result, {
    panNumber: "ABCDE1234F",
    verifiedName: "Rahul Kumar Sharma",
    maskedIdentifier: "XXXXXX234F",
  });
});

test("rejects a response containing a provider business error", () => {
  assert.throws(
    () => validatePanDetailedResponse({
      status: "success",
      error_code: "IDTO_202",
      data: null,
    }),
    { message: "PAN_PROVIDER_BUSINESS_ERROR" },
  );
});

test("rejects an invalid PAN number", () => {
  assert.throws(
    () => validatePanDetailedResponse({
      ...VALID_RESPONSE,
      data: {
        ...VALID_RESPONSE.data,
        pan_number: "INVALID123",
      },
    }),
    { message: "INVALID_PAN_PROVIDER_RESPONSE" },
  );
});

test("rejects a missing verified name", () => {
  assert.throws(
    () => validatePanDetailedResponse({
      ...VALID_RESPONSE,
      data: {
        ...VALID_RESPONSE.data,
        full_name: "   ",
      },
    }),
    { message: "PAN_VERIFIED_NAME_UNAVAILABLE" },
  );
});

test("rejects a malformed provider response", () => {
  assert.throws(
    () => validatePanDetailedResponse(null),
    { message: "INVALID_PAN_PROVIDER_RESPONSE" },
  );
});

test("validates the approved AquaPay request and normalizes PAN case", () => {
  assert.deepEqual(validatePanVerificationInput({ panNumber: "abcde1234f", consent: true }), {
    panNumber: "ABCDE1234F",
    consent: true,
  });
});

test("requires explicit consent and rejects unexpected client identity fields", () => {
  assert.throws(() => validatePanVerificationInput({ panNumber: "ABCDE1234F", consent: false }), {
    code: "PAN_CONSENT_REQUIRED",
  });
  assert.throws(() => validatePanVerificationInput({
    panNumber: "ABCDE1234F", consent: true, aadhaarName: "untrusted",
  }), { code: "VALIDATION_ERROR" });
});

test("requires a null error_code and ignores provider DOB", () => {
  assert.throws(() => validatePanDetailedResponse({ status: "success", data: VALID_RESPONSE.data }), {
    message: "INVALID_PAN_PROVIDER_RESPONSE",
  });
  const response = structuredClone(VALID_RESPONSE);
  delete response.data.dob;
  assert.equal(validatePanDetailedResponse(response).panNumber, "ABCDE1234F");
});
