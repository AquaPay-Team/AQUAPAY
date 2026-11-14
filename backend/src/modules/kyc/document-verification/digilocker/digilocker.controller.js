import { randomUUID } from "node:crypto";
import asyncHandler from "../../../../utils/asyncHandler.js";
import ApiResponse from "../../../../utils/ApiResponse.js";
import ApiError from "../../../../utils/ApiError.js";
import httpStatus from "../../../../utils/httpStatus.js";
import digilockerService from "./digilocker.service.js";
import digilockerProvider from "./digilocker.provider.js";

const HTML_SUCCESS_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Aadhaar Verification Completed - AquaPay</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #0f172a; }
    .card { background: white; border-radius: 20px; padding: 36px 28px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.08); text-align: center; max-width: 400px; width: 90%; border: 1px solid #e2e8f0; }
    .icon { width: 56px; height: 56px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #059669; font-size: 26px; }
    h2 { margin: 0 0 8px; font-size: 20px; font-weight: 700; color: #0f172a; }
    p { margin: 0 0 20px; font-size: 14px; color: #64748b; line-height: 1.5; }
    .btn { display: inline-block; background: #2563eb; color: white; padding: 10px 24px; border-radius: 10px; font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer; border: none; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">&#10003;</div>
    <h2>Identity Verified!</h2>
    <p>Your Aadhaar e-KYC has been successfully authenticated with UIDAI via DigiLocker.</p>
    <p style="font-size: 12px; color: #94a3b8;">This window will close automatically...</p>
    <button class="btn" onclick="window.close()">Close Window</button>
  </div>
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'DIGILOCKER_COMPLETED', success: true }, '*');
      }
    } catch (e) {}
    setTimeout(function() {
      try { window.close(); } catch(e) {}
    }, 1800);
  </script>
</body>
</html>`;

const callback = asyncHandler(async (req, res) => {
  const correlationId = randomUUID();
  res.set("X-Correlation-ID", correlationId);
  const isHtml = req.headers.accept?.includes("text/html");

  try {
    const data = await digilockerService.completeCallback(req.validatedCallback, { correlationId });
    if (isHtml) {
      return res.status(httpStatus.OK).send(HTML_SUCCESS_PAGE);
    }
    return res.status(httpStatus.OK).json(
      new ApiResponse(httpStatus.OK, data, "DigiLocker verification completed"),
    );
  } catch (err) {
    const errCode = err?.code || err?.message;
    if (
      isHtml &&
      (errCode === "DIGILOCKER_SESSION_NOT_ACTIVE" ||
       errCode === "INVALID_OR_EXPIRED_STATE" ||
       String(errCode).includes("SESSION_NOT_ACTIVE"))
    ) {
      return res.status(httpStatus.OK).send(HTML_SUCCESS_PAGE);
    }
    throw err;
  }
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
