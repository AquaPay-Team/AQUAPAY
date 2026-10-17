class ApiError extends Error {
  constructor(
    statusCode,
    message = "Something went wrong",
    errors = [],
    code = "",
    stack = "",
  ) {
    super(message);

    this.name = "ApiError";
    this.statusCode = statusCode;
    this.data = null;
    this.success = false;

    // Support both existing API calls and authentication calls.
    // Existing: new ApiError(400, "Invalid input", errors, "VALIDATION_ERROR")
    // Auth:     new ApiError(401, "Unauthorized", "UNAUTHORIZED")
    if (typeof errors === "string") {
      code = code || errors;
      errors = [];
    }

    this.errors = Array.isArray(errors) ? errors : [];

    this.code =
      code ||
      (statusCode === 400
        ? "VALIDATION_ERROR"
        : statusCode === 401
          ? "UNAUTHORIZED"
          : statusCode === 403
            ? "FORBIDDEN"
            : statusCode === 404
              ? "NOT_FOUND"
              : statusCode === 409
                ? "DUPLICATE_ENTRY"
                : "INTERNAL_ERROR");

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

module.exports = ApiError;
