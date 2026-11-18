import {
  uploadMedia,
  restartRejectedKyc,
} from "./media.service.js";
import asyncHandler from "../../../utils/asyncHandler.js";
import ApiResponse from "../../../utils/ApiResponse.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const uploadKycMedia = asyncHandler(async (req, res) => {
  const userId = req.user?.id;

  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const { assetType } = req.validatedBody;

  const data = await uploadMedia(userId, assetType, req.file);

  return res
    .status(httpStatus.CREATED)
    .json(
      new ApiResponse(httpStatus.CREATED, data, "Media uploaded successfully"),
    );
});

const restartRejectedKycController = asyncHandler(
  async (req, res) => {
    const userId = req.user?.id;

    if (!userId) {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Authentication required",
        [],
        "UNAUTHORIZED",
      );
    }

    const data = await restartRejectedKyc(userId);

    return res.status(httpStatus.OK).json(
      new ApiResponse(
        httpStatus.OK,
        data,
        "KYC restarted successfully",
      ),
    );
  },
);

export {
  uploadKycMedia,
  restartRejectedKycController,
};

export default {
  uploadKycMedia,
  restartRejectedKycController,
};