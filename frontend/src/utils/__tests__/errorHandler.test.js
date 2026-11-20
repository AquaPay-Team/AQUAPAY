import { describe, it, expect } from "vitest";
import { parseApiError, extractFieldErrors } from "../errorHandler.js";

describe("errorHandler", () => {
  it("correctly identifies network errors", () => {
    const error = { code: "ERR_NETWORK" };
    const parsed = parseApiError(error);
    expect(parsed.type).toBe("NETWORK_ERROR");
    expect(parsed.message).toContain("Unable to connect");
  });

  it("extracts dictionary fieldErrors properly", () => {
    const data = {
      errors: {
        email: "Email already taken",
        phone: ["Invalid format", "Too short"],
      },
    };
    const fieldErrors = extractFieldErrors(data);
    expect(fieldErrors.email).toBe("Email already taken");
    expect(fieldErrors.phone).toBe("Invalid format, Too short");
  });

  it("infers field from error message strings", () => {
    const data = {
      errors: [
        "Aadhaar number must be 12 digits",
        "PAN format is invalid",
        "Pincode must be a 6 digit number",
      ],
    };
    const fieldErrors = extractFieldErrors(data);
    expect(fieldErrors.aadhaarNumber).toBe("Aadhaar number must be 12 digits");
    expect(fieldErrors.panNumber).toBe("PAN format is invalid");
    expect(fieldErrors.pincode).toBe("Pincode must be a 6 digit number");
  });
});