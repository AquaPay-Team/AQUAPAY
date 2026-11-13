import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const ALLOWED_FIELDS = new Set(["assetType"]);

const ALLOWED_ASSET_TYPES = new Set(["shop_image", "selfie", "consent_video"]);

function validateMediaUpload(req, res, next) {
  const body = req.body;
  const errors = [];

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return next(
      new ApiError(
        httpStatus.BAD_REQUEST,
        "Request body must be a valid object",
        ["Request body must be a valid object"],
        "VALIDATION_ERROR",
      ),
    );
  }

  for (const field of Object.keys(body)) {
    if (!ALLOWED_FIELDS.has(field)) {
      errors.push(`Unexpected request field: ${field}`);
    }
  }

  const assetType =
    typeof body.assetType === "string" ? body.assetType.trim() : "";

  if (!assetType) {
    errors.push("Asset type is required");
  } else if (!ALLOWED_ASSET_TYPES.has(assetType)) {
    errors.push("Asset type must be shop_image, selfie, or consent_video");
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

  req.validatedBody = { assetType };

  return next();
}

export { validateMediaUpload };

export default {
  validateMediaUpload,
};
