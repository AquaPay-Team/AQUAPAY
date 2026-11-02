import { randomUUID } from "node:crypto";
import asyncHandler from "../../../../utils/asyncHandler.js";
import ApiResponse from "../../../../utils/ApiResponse.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import digilockerService from "./digilocker.service.js";
import digilockerProvider from "./digilocker.provider.js";

const callback = asyncHandler(async (req, res) => {
  const correlationId = randomUUID();
  res.set("X-Correlation-ID", correlationId);
  const data = await digilockerService.completeCallback(req.validatedCallback, { correlationId });
  return res.status(httpStatus.OK).json(
    new ApiResponse(httpStatus.OK, data, "DigiLocker verification completed"),
  );
});

const mockAuthorize = asyncHandler(async (req, res) => {
  const queryKeys = Object.keys(req.query || {});
  if (
    digilockerProvider.mode !== "mock" ||
    queryKeys.length !== 2 ||
    !queryKeys.includes("state") ||
    !queryKeys.includes("document")
  ) {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid local mock authorization request", [], "INVALID_MOCK_AUTHORIZATION");
  }

  let callbackParameters;
  try {
    callbackParameters = digilockerProvider.getMockCallbackParameters(req.query);
  } catch {
    throw new ApiError(httpStatus.BAD_REQUEST, "Invalid local mock authorization request", [], "INVALID_MOCK_AUTHORIZATION");
  }

  const target = new URL("/api/kyc/digilocker/callback", "http://localhost");
  for (const [key, value] of Object.entries(callbackParameters)) {
    target.searchParams.set(key, value);
  }
  return res.redirect(303, `${target.pathname}${target.search}`);
});

export { callback, mockAuthorize };
export default { callback, mockAuthorize };
