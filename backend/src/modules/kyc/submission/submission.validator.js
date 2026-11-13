import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = new Set(["confirm", "notes"]);

function validateSubmitKyc(req, res, next) {
  const body = req.body || {};
  const errors = [];

  if (body !== null && typeof body !== "object") {
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

  if (body.confirm !== undefined && body.confirm !== true) {
    errors.push("Confirm flag must be true if provided");
  }

  if (body.notes !== undefined) {
    if (typeof body.notes !== "string") {
      errors.push("Notes must be a string");
    } else if (body.notes.length > 500) {
      errors.push("Notes must not exceed 500 characters");
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
    confirm: body.confirm ?? true,
    notes: body.notes ? body.notes.trim() : null,
  };

  return next();
}

export { validateSubmitKyc };
export default { validateSubmitKyc };

