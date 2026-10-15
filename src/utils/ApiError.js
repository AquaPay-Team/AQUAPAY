class ApiError extends Error {
  constructor(statusCode, message, code) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ApiError;
