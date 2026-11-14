/**
 * Centralized API Error Parser for AquaPay
 * Handles Network errors, Server 500s, 401 Auth failures, 429 Rate limits, and Validation errors.
 * Extracts field-specific validation errors for inline form rendering.
 */

export function extractFieldErrors(data) {
  const fieldErrors = {};
  if (!data) return fieldErrors;

  // 1. Direct fieldErrors dictionary if provided by API (e.g. { errors: { email: "Invalid" } })
  if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    for (const [key, val] of Object.entries(data.errors)) {
      fieldErrors[key] = Array.isArray(val) ? val.join(", ") : String(val);
    }
  }

  // 2. Array of error strings or message (e.g. ["Pincode must be a valid 6-digit postal code"])
  const rawList = Array.isArray(data.errors)
    ? data.errors
    : typeof data.message === "string"
    ? [data.message]
    : [];

  for (const item of rawList) {
    const text = String(item);
    const lower = text.toLowerCase();

    if (lower.includes("dob") || lower.includes("date of birth") || lower.includes("birth") || lower.includes("future")) {
      fieldErrors.dob = text;
    } else if (lower.includes("pincode") || lower.includes("postal")) {
      fieldErrors.pincode = text;
    } else if (lower.includes("shop address") || (lower.includes("address") && !lower.includes("email"))) {
      fieldErrors.shopAddress = text;
    } else if (lower.includes("city")) {
      fieldErrors.city = text;
    } else if (lower.includes("state")) {
      fieldErrors.state = text;
    } else if (lower.includes("business") || lower.includes("constitution")) {
      fieldErrors.businessType = text;
    } else if (lower.includes("full legal name") || lower.includes("full name") || lower.includes("name")) {
      fieldErrors.fullName = text;
    } else if (lower.includes("mobile") || lower.includes("phone")) {
      fieldErrors.phone = text;
    } else if (lower.includes("email")) {
      fieldErrors.email = text;
    } else if (lower.includes("aadhaar")) {
      fieldErrors.aadhaarNumber = text;
    } else if (lower.includes("pan")) {
      fieldErrors.panNumber = text;
    } else if (lower.includes("account") || lower.includes("beneficiary")) {
      fieldErrors.accountNumber = text;
    } else if (lower.includes("ifsc")) {
      fieldErrors.ifscCode = text;
    }
  }

  return fieldErrors;
}

export function parseApiError(err) {
  // 1. Network / Offline / Server Unreachable Error
  if (!err?.response) {
    if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
      return {
        type: "NETWORK_ERROR",
        title: "Network Connection Failed",
        message:
          "Unable to connect to AquaPay servers. Please check your internet connection or verify the backend service is running.",
        fieldErrors: {},
        errors: [],
      };
    }

    if (err?.code === "ECONNABORTED" || err?.message?.includes("timeout")) {
      return {
        type: "TIMEOUT_ERROR",
        title: "Request Timed Out",
        message:
          "The server took too long to respond. Please check your connection and try again.",
        fieldErrors: {},
        errors: [],
      };
    }

    return {
      type: "NETWORK_ERROR",
      title: "Connection Error",
      message:
        err?.message ||
        "A network communication error occurred. Please verify your connection.",
      fieldErrors: {},
      errors: [],
    };
  }

  const { status, data } = err.response;
  const backendMessage = data?.message;
  const backendCode = data?.code;
  const fieldErrors = extractFieldErrors(data);
  const errorList = Array.isArray(data?.errors) ? data.errors : [];

  // Determine specific display message instead of generic messages
  const specificMessage =
    errorList.length > 0
      ? errorList.join(". ")
      : backendMessage;

  // Specific KYC Domain Errors
  const KYC_ERROR_MAP = {
    KYC_PREREQUISITE_NOT_COMPLETED: "Complete the previous KYC step first before proceeding.",
    AADHAAR_PREREQUISITE_NOT_COMPLETED: "Complete Aadhaar verification first before PAN verification.",
    AADHAAR_VERIFIED_NAME_UNAVAILABLE: "Verified Aadhaar details are unavailable. Please complete Aadhaar verification.",
    AADHAAR_VERIFIED_NAME_CHANGED: "Aadhaar verified identity changed. Please restart verification.",
    PAN_ALREADY_VERIFIED: "PAN verification is already completed.",
    PAN_INVALID: "The PAN number entered is invalid according to Income Tax records.",
    PAN_NOT_FOUND: "PAN could not be verified with the Income Tax Department.",
    BANK_DETAILS_MISMATCH: "Bank account details could not be verified. Please check the account number and IFSC.",
    INVALID_IFSC: "Invalid IFSC code. Please check and try again.",
    BASIC_DETAILS_REQUIRED: "Save valid basic details before requesting OTP.",
    INVALID_OR_EXPIRED_OTP: "Invalid or expired OTP. Please request a new verification code.",
    CONSENT_REQUIRED: "Your consent is required to proceed with identity verification.",
    KYC_CASE_NOT_FOUND: "No active KYC application found for this account.",
    KYC_CASE_NOT_EDITABLE: "This KYC application is not available for editing.",
  };

  if (backendCode && KYC_ERROR_MAP[backendCode]) {
    return {
      type: "KYC_ERROR",
      title: "KYC Verification",
      message: specificMessage || KYC_ERROR_MAP[backendCode],
      fieldErrors,
      errors: errorList,
    };
  }

  // 2. Authentication Failures (401)
  if (status === 401 || backendCode === "AUTH_FAILED" || backendCode === "UNAUTHORIZED") {
    return {
      type: "AUTH_FAILED",
      title: "Authentication Failed",
      message:
        specificMessage ||
        "The username, email, or password you entered is incorrect. Please verify and try again.",
      fieldErrors,
      errors: errorList,
    };
  }

  // 3. Forbidden / Account Status Issues (403)
  if (status === 403 || backendCode === "FORBIDDEN") {
    return {
      type: "FORBIDDEN",
      title: "Access Restricted",
      message:
        specificMessage ||
        "Your account is inactive, suspended, or does not have permission to perform this action.",
      fieldErrors,
      errors: errorList,
    };
  }

  // 4. Rate Limiting (429)
  if (status === 429 || backendCode === "RATE_LIMIT_EXCEEDED") {
    return {
      type: "RATE_LIMIT",
      title: "Too Many Attempts",
      message:
        specificMessage ||
        "Too many requests have been made from this device or account. Please wait a few moments before trying again.",
      fieldErrors,
      errors: errorList,
    };
  }

  // 5. Server Errors (500, 502, 503, 504)
  if (status >= 500) {
    if (status === 503 || backendCode === "SERVICE_UNAVAILABLE") {
      return {
        type: "SERVICE_UNAVAILABLE",
        title: "Service Temporarily Unavailable",
        // Prioritize specific backend message or field errors if present
        message:
          specificMessage ||
          "The verification service is temporarily unavailable. Please try again shortly.",
        fieldErrors,
        errors: errorList,
      };
    }

    return {
      type: "SERVER_ERROR",
      title: "Server Problem",
      message:
        specificMessage ||
        "Our backend encountered an unexpected error. Our engineering team has been notified. Please try again later.",
      fieldErrors,
      errors: errorList,
    };
  }

  // 6. Validation / Bad Request Errors (400, 422)
  if (status === 400 || status === 422 || backendCode === "VALIDATION_ERROR") {
    return {
      type: "VALIDATION_ERROR",
      title: "Validation Error",
      message:
        specificMessage ||
        "The submitted information is invalid. Please review highlighted fields.",
      fieldErrors,
      errors: errorList,
    };
  }

  // 7. Not Found (404)
  if (status === 404) {
    return {
      type: "NOT_FOUND",
      title: "Not Found",
      message: specificMessage || "The requested resource could not be found.",
      fieldErrors,
      errors: errorList,
    };
  }

  // Fallback Generic
  return {
    type: "GENERIC_ERROR",
    title: "Request Error",
    message: specificMessage || err.message || "An unexpected error occurred. Please try again.",
    fieldErrors,
    errors: errorList,
  };
}

