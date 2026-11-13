import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = new Set(["accepted", "agreementCode", "agreementVersion"]);

function validateAcceptAgreement(req, res, next) {
  const body = req.body;
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "Request body must be a valid JSON object",
        ["Request body must be a valid JSON object"],
        "VALIDATION_ERROR",
      ),
    );
  }

  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`Unexpected request field: ${field}`);
    }
  }

  if (body.accepted !== true) {
    errors.push("You must accept the agreement terms and conditions (accepted must be true)");
  }

  let agreementCode = "AQUAPAY_AGENT_AGREEMENT";
  if (body.agreementCode !== undefined) {
    if (typeof body.agreementCode !== "string" || !body.agreementCode.trim()) {
      errors.push("Agreement code must be a non-empty string");
    } else if (body.agreementCode.trim().length > 100) {
      errors.push("Agreement code must not exceed 100 characters");
    } else {
      agreementCode = body.agreementCode.trim();
    }
  }

  let agreementVersion = "v1.0";
  if (body.agreementVersion !== undefined) {
    if (typeof body.agreementVersion !== "string" || !body.agreementVersion.trim()) {
      errors.push("Agreement version must be a non-empty string");
    } else if (body.agreementVersion.trim().length > 50) {
      errors.push("Agreement version must not exceed 50 characters");
    } else {
      agreementVersion = body.agreementVersion.trim();
    }
  }

  if (errors.length > 0) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        errors.join(", "),
        errors,
        "VALIDATION_ERROR",
      ),
    );
  }

  req.validatedBody = {
    accepted: true,
    agreementCode,
    agreementVersion,
  };

  return next();
}

export { validateAcceptAgreement };
export default { validateAcceptAgreement };

