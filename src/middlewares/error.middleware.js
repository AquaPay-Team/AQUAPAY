function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err.statusCode) ? err.statusCode : err.status;
  const clientError = Number.isInteger(status) && status >= 400 && status < 500;
  const clientMessage = err.type === "entity.parse.failed"
    ? "Invalid request body"
    : (clientError ? err.message : "Internal server error");
  if (!clientError) {
    const logContext = {};
    if (typeof err.name === "string" && /^[A-Za-z0-9_]{1,64}$/.test(err.name)) {
      logContext.name = err.name;
    }
    if (typeof err.code === "string" && /^[A-Z0-9_]{1,64}$/.test(err.code)) {
      logContext.code = err.code;
    }
    console.error("Request failed with server error", logContext);
  }

  res.status(clientError ? status : 500).json({
    success: false,
    message: clientMessage,
    ...(clientError && err.code ? { code: err.code } : {})
  });
}

module.exports = { notFound, errorHandler };
