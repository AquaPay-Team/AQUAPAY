/**
 * AquaPay Centralized Error Normalizer
 * Standardizes errors across network, server, and validation responses.
 */

export function extractFieldErrors(data) {
  const fieldErrors = {};
  if (!data) return fieldErrors;

  if (data.errors && typeof data.errors === "object" && !Array.isArray(data.errors)) {
    for (const [key, val] of Object.entries(data.errors)) {
      fieldErrors[key] = Array.isArray(val) ? val.join(", ") : String(val);
    }
  }

  const rawList = Array.isArray(data.errors)
    ? data.errors
    : typeof data.message === "string"
    ? [data.message]
    : [];

  for (const item of rawList) {
    const text = String(item);
    const lower = text.toLowerCase();

    if (lower.includes("dob") || lower.includes("birth")) {
      fieldErrors.dob = text;
    } else if (lower.includes("pincode") || lower.includes("postal")) {
      fieldErrors.pincode = text;
    } else if (lower.includes("address") && !lower.includes("email")) {
      fieldErrors.shopAddress = text;
    } else if (lower.includes("city")) {
      fieldErrors.city = text;
    } else if (lower.includes("state")) {
      fieldErrors.state = text;
    } else if (lower.includes("business") || lower.includes("constitution")) {
      fieldErrors.businessType = text;
    } else if (lower.includes("name")) {
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
  if (!err?.response) {
    if (err?.code === "ERR_NETWORK" || err?.message === "Network Error") {
      return {
        type: "NETWORK_ERROR",
        title: "Network Connection Failed",
        message: "Unable to connect to AquaPay servers. Please verify your connection or backend service.",
        fieldErrors: {},
      };
    }
    return {
      type: "CLIENT_ERROR",
      title: "Unexpected Error",
      message: err?.message || "An unexpected client error occurred.",
      fieldErrors: {},
    };
  }

  const { status, data } = err.response;
  const fieldErrors = extractFieldErrors(data);
  const specificMessage = typeof data?.message === "string" ? data.message : null;
  const backendCode = data?.code || data?.errorCode || null;
  const errorList = Array.isArray(data?.errors) ? data.errors : [];

  if (status === 401 || backendCode === "TOKEN_EXPIRED") {
    return {
      type: "AUTH_EXPIRED",
      title: "Session Expired",
      message: specificMessage || "Your session has expired. Please log in again.",
      fieldErrors,
      errors: errorList,
    };
  }

  if (status === 403 || backendCode === "FORBIDDEN") {
    return {
      type: "PERMISSION_DENIED",
      title: "Access Denied",
      message: specificMessage || "You do not have permission to perform this action.",
      fieldErrors,
      errors: errorList,
    };
  }

  if (status === 429) {
    return {
      type: "RATE_LIMITED",
      title: "Too Many Requests",
      message: specificMessage || "Too many requests. Please slow down and try again shortly.",
      fieldErrors,
      errors: errorList,
    };
  }

  if (status >= 500) {
    return {
      type: "SERVER_ERROR",
      title: "Server Unavailable",
      message: specificMessage || "Our servers encountered an unexpected issue. Please try again shortly.",
      fieldErrors,
      errors: errorList,
    };
  }

  if (status === 400 || status === 422 || backendCode === "VALIDATION_ERROR") {
    return {
      type: "VALIDATION_ERROR",
      title: "Validation Error",
      message: specificMessage || "The submitted information is invalid. Please review highlighted fields.",
      fieldErrors,
      errors: errorList,
    };
  }

  if (status === 404) {
    return {
      type: "NOT_FOUND",
      title: "Not Found",
      message: specificMessage || "The requested resource could not be found.",
      fieldErrors,
      errors: errorList,
    };
  }

  return {
    type: "GENERIC_ERROR",
    title: "Request Error",
    message: specificMessage || err.message || "An unexpected error occurred. Please try again.",
    fieldErrors,
    errors: errorList,
  };
}