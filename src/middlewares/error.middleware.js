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

  const statusCode = err.statusCode || err.status || 500;
  if (statusCode >= 500) {
    console.error(err);
  }

  const response = {
    success: false,
    message: statusCode >= 500 ? "Internal server error" : (err.message || "An error occurred")
  };

  if (err.code) {
    response.code = err.code;
  }

  if (err.errors && Array.isArray(err.errors) && err.errors.length > 0) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
}

module.exports = { notFound, errorHandler };

