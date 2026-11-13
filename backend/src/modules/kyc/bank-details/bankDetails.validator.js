import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = new Set([
  "ifscCode",
  "accountNumber",
]);

function validateBankDetails(req, res, next) {
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

  const ifscCode =
    typeof body.ifscCode === "string"
      ? body.ifscCode.trim().toUpperCase()
      : "";

  const accountNumber =
    typeof body.accountNumber === "string"
      ? body.accountNumber.trim()
      : "";

  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode)) {
    errors.push("A valid 11-character IFSC code is required");
  }

  if (!/^\d{9,18}$/.test(accountNumber)) {
    errors.push("Account number must contain 9 to 18 digits");
  }

  if (errors.length) {
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
    ifscCode,
    accountNumber,
  };

  return next();
}

export { validateBankDetails };
export default { validateBankDetails };