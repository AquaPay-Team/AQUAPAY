import schemeService from "./scheme.service.js";
import ApiError from "../../../utils/ApiError.js";

async function getSchemesController(req, res, next) {
  try {
    const search = req.query?.search;
    if (
      search !== undefined &&
      (typeof search !== "string" || search.length > 100)
    ) {
      throw new ApiError(400, "Invalid scheme search", [], "VALIDATION_ERROR");
    }

    const schemes = await schemeService.getSchemes(search?.trim() || "");
    return res.status(200).json({
      success: true,
      message: "Schemes fetched successfully",
      data: schemes,
    });
  } catch (error) {
    return next(error);
  }
}

async function createSchemeController(req, res, next) {
  try {
    const name = req.body?.name;
    if (typeof name !== "string") {
      throw new ApiError(400, "Scheme name is required", [], "VALIDATION_ERROR");
    }

    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new ApiError(
        400,
        "Scheme name must contain between 1 and 100 characters",
        [],
        "VALIDATION_ERROR",
      );
    }

    const scheme = await schemeService.createScheme(trimmedName);
    return res.status(201).json({
      success: true,
      message: "Scheme created successfully",
      data: scheme,
    });
  } catch (error) {
    return next(error);
  }
}

async function updateSchemeStatusController(req, res, next) {
  try {
    const rawId = req.params.schemeId;
    const schemeId = Number(rawId);
    if (!/^[1-9]\d*$/.test(rawId) || !Number.isSafeInteger(schemeId)) {
      throw new ApiError(400, "Invalid scheme ID", [], "VALIDATION_ERROR");
    }

    const rawStatus = req.body?.status;
    if (![0, 1, "0", "1"].includes(rawStatus)) {
      throw new ApiError(400, "Status must be 0 or 1", [], "VALIDATION_ERROR");
    }

    const scheme = await schemeService.updateSchemeStatus(
      schemeId, Number(rawStatus), req.user?.id,
    );
    return res.status(200).json({
      success: true,
      message: "Scheme status updated successfully",
      data: scheme,
    });
  } catch (error) {
    return next(error);
  }
}

const schemeController = {
  getSchemesController,
  createSchemeController,
  updateSchemeStatusController,
};

export {
  getSchemesController,
  createSchemeController,
  updateSchemeStatusController,
};
export default schemeController;
