import { recordApplicationError } from "../monitoring/operationsMonitor.js";

function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}


function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.statusCode)
    ? err.statusCode
    : err.status;

  const isClientError =
    Number.isInteger(status) && status >= 400 && status < 500;

  const isServiceUnavailable = status === 503;

  const statusCode = isClientError
    ? status
    : isServiceUnavailable
      ? 503
      : 500;

  const message =
    err.type === "entity.parse.failed"
      ? "Invalid request body"
      : isClientError
        ? err.message || "Request failed"
        : isServiceUnavailable
          ? "Service temporarily unavailable"
          : "Internal server error";

  if (!isClientError) {
    const logEntry = {
      method: req.method,
      path: `${req.baseUrl || ""}${req.route?.path || req.path}`,
      statusCode,
    };

    if (process.env.NODE_ENV === "development") {
      if (typeof err.name === "string" && /^[A-Za-z][A-Za-z0-9_]{0,39}$/.test(err.name)) {
        logEntry.errorName = err.name;
      }
      if (typeof err.code === "string" && /^[A-Za-z0-9_]{1,48}$/.test(err.code)) {
        logEntry.errorCode = err.code;
      }
    }

    console.error("[AquaPay Error]", logEntry);
    recordApplicationError(req, statusCode);
  }

  const response = {
    success: false,
    message,
  };

  if (
    (isClientError || isServiceUnavailable) &&
    typeof err.code === "string"
  ) {
    response.code = err.code;
  }

  if (
    isClientError &&
    Array.isArray(err.errors) &&
    err.errors.length > 0
  ) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}


export { notFound, errorHandler };

export default { notFound, errorHandler };
