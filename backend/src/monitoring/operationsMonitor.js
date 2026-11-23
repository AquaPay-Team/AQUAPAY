const startedAt = new Date();
const MAX_LOG_ENTRIES = 100;

const requestMetrics = {
  requestCount: 0,
  errorCount: 0,
  totalLatencyMs: 0,
};
const events = [];

function safePath(req) {
  return `${req.baseUrl || ""}${req.route?.path || req.path || ""}`.slice(0, 200);
}

function addEvent(event) {
  events.unshift({
    occurredAt: new Date().toISOString(),
    ...event,
  });
  if (events.length > MAX_LOG_ENTRIES) events.length = MAX_LOG_ENTRIES;
}

function requestMonitoringMiddleware(req, res, next) {
  const requestStartedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const latencyMs = Number(process.hrtime.bigint() - requestStartedAt) / 1e6;
    requestMetrics.requestCount += 1;
    requestMetrics.totalLatencyMs += latencyMs;

    if (res.statusCode >= 500) requestMetrics.errorCount += 1;
  });

  next();
}

function recordApplicationError(req, statusCode) {
  if (statusCode < 500) return;
  addEvent({
    level: "error",
    event: "request_failed",
    method: req.method,
    path: safePath(req),
    statusCode,
  });
}

function getMonitoringSnapshot() {
  const requestCount = requestMetrics.requestCount;
  return {
    server: {
      liveness: "alive",
      startedAt: startedAt.toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
    },
    api: {
      scope: "current_process_since_start",
      requestCount,
      errorCount: requestMetrics.errorCount,
      errorRatePercent: requestCount
        ? Number(((requestMetrics.errorCount / requestCount) * 100).toFixed(2))
        : 0,
      averageLatencyMs: requestCount
        ? Math.round(requestMetrics.totalLatencyMs / requestCount)
        : null,
    },
    logs: {
      scope: "in_memory_current_process",
      entries: events.slice(),
    },
  };
}

function resetOperationsMonitorForTests() {
  requestMetrics.requestCount = 0;
  requestMetrics.errorCount = 0;
  requestMetrics.totalLatencyMs = 0;
  events.length = 0;
}

export {
  getMonitoringSnapshot,
  recordApplicationError,
  requestMonitoringMiddleware,
  resetOperationsMonitorForTests,
};
