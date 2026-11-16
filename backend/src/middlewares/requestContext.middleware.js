import crypto from "node:crypto";
import { requestContext } from "../utils/logger.js";

function requestContextMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);
  requestContext.run({ requestId }, next);
}

export { requestContextMiddleware };
export default requestContextMiddleware;
