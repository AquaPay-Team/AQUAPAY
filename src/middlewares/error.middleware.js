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

  const status = Number.isInteger(err.statusCode) ? err.statusCode : err.status;

  const isClientError =
    Number.isInteger(status) && status >= 400 && status < 500;

  const statusCode = isClientError ? status : 500;

  const message =
    err.type === "entity.parse.failed"
      ? "Invalid request body"
      : isClientError
        ? err.message || "Request failed"
        : "Internal server error";

  if (!isClientError) {
    console.error("Request failed with server error", {
      name: typeof err.name === "string" ? err.name : "Error",
      code: typeof err.code === "string" ? err.code : undefined,
    });
  }

  const response = {
    success: false,
    message,
  };

  if (isClientError && typeof err.code === "string") {
    response.code = err.code;
  }

  if (isClientError && Array.isArray(err.errors) && err.errors.length > 0) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFound, errorHandler };
