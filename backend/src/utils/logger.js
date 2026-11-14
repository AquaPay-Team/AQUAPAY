import { AsyncLocalStorage } from "node:async_hooks";

const requestContext = new AsyncLocalStorage();
const SENSITIVE_KEY = /(?:secret|password|token|authorization|cookie|credential|api.?key|verifier|aadhaar|pan|account.?number|otp|reference.?key|xml|body|query|mobile|email|address|(?:^|_)(?:full_)?name$|(?:verified|holder|person)Name$)/i;

function safeValue(value, key = "", depth = 0) {
  if (key !== "errorName" && SENSITIVE_KEY.test(key)) return undefined;
  if (depth > 4) return undefined;
  if (value === null || typeof value === "boolean" || typeof value === "number") {
    return Number.isFinite(value) || typeof value !== "number" ? value : undefined;
  }
  if (typeof value === "string") {
    return value.replace(/[\u0000-\u001f\u007f]/g, " ").slice(0, 160);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => safeValue(item, key, depth + 1)).filter((item) => item !== undefined);
  }
  if (typeof value === "object") {
    const entries = Object.entries(value).slice(0, 30);
    return Object.fromEntries(entries
      .map(([childKey, childValue]) => [childKey, safeValue(childValue, childKey, depth + 1)])
      .filter(([, childValue]) => childValue !== undefined));
  }
  return undefined;
}

function write(level, event, fields = {}) {
  const context = requestContext.getStore();
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event: String(event || "application.event").slice(0, 120),
    ...(context?.requestId ? { requestId: context.requestId } : {}),
    ...safeValue(fields),
  };
  console[level](JSON.stringify(record));
}

const logger = Object.freeze({
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields),
});

export { logger, requestContext, safeValue };
export default logger;
