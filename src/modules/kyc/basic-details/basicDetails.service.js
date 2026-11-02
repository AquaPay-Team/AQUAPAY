import crypto from "node:crypto";
import basicDetailsModel from "./basicDetails.model.js";
import kycOtpStore from "./kycOtpStore.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import { isValidPincode } from "../../../utils/validationHelper.js";

const BASIC_DETAILS_STEP = 1;
const OTP_TTL_SECONDS = 300;

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

function logDevelopmentFailure(operation, error) {
  if (process.env.NODE_ENV !== "development") return;

  const details = {};
  if (typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)) {
    details.code = error.code;
  }
  if (Number.isInteger(error?.errno)) details.errno = error.errno;
  if (typeof error?.sqlState === "string" && /^[A-Z0-9]{5}$/.test(error.sqlState)) {
    details.sqlState = error.sqlState;
  }
  if (Object.keys(details).length === 0) {
    details.errorType = typeof error?.name === "string" ? error.name : "UnknownError";
  }

  console.error(`[AquaPay KYC] ${operation} failed`, details);
}

function invalidOtp() {
  return new ApiError(
    httpStatus.BAD_REQUEST,
    "Invalid or expired OTP",
    [],
    "INVALID_OR_EXPIRED_OTP",
  );
}

function getKycOtpSecret() {
  const secret = process.env.KYC_OTP_SECRET;
  if (
    typeof secret !== "string" ||
    secret.length < 32 ||
    /replace|example|placeholder/i.test(secret)
  ) {
    throw new Error("KYC_OTP_SECRET is not configured securely");
  }
  return secret;
}

function getSavedBasicDetails(user, kycCase) {
  const details = {
    businessType: typeof kycCase.business_type === "string"
      ? kycCase.business_type.trim()
      : "",
    shopAddress: typeof user.address === "string" ? user.address.trim() : "",
    city: typeof user.city === "string" ? user.city.trim() : "",
    pincode: user.pincode === null || user.pincode === undefined
      ? ""
      : String(user.pincode).trim(),
  };

  if (
    !details.businessType ||
    details.businessType.length > 100 ||
    !details.shopAddress ||
    details.shopAddress.length > 255 ||
    !details.city ||
    details.city.length > 100 ||
    !details.pincode ||
    !isValidPincode(details.pincode)
  ) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Save valid basic details before requesting OTP",
      [],
      "BASIC_DETAILS_REQUIRED",
    );
  }
  return details;
}

function detailsFingerprint(secret, userId, caseId, details) {
  return crypto
    .createHmac("sha256", secret)
    .update(`aquapay:kyc:step1:details:${JSON.stringify([
      String(userId),
      String(caseId),
      BASIC_DETAILS_STEP,
      details.businessType,
      details.shopAddress,
      details.city,
      details.pincode,
    ])}`)
    .digest("hex");
}

function hashOtp(secret, userId, caseId, fingerprint, otp) {
  return crypto
    .createHmac("sha256", secret)
    .update(`aquapay:kyc:step1:otp:${JSON.stringify([
      String(userId),
      String(caseId),
      BASIC_DETAILS_STEP,
      fingerprint,
      otp,
    ])}`)
    .digest("hex");
}

function hashRateScope(secret, kind, value) {
  return crypto
    .createHmac("sha256", secret)
    .update(`aquapay:kyc:step1:rate:${kind}:${String(value || "unknown")}`)
    .digest("hex");
}

function secureHashEquals(storedHash, expectedHash) {
  if (
    typeof storedHash !== "string" ||
    typeof expectedHash !== "string" ||
    !/^[a-f0-9]{64}$/i.test(storedHash) ||
    !/^[a-f0-9]{64}$/i.test(expectedHash)
  ) {
    return false;
  }
  const stored = Buffer.from(storedHash, "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return stored.length === expected.length && crypto.timingSafeEqual(stored, expected);
}

async function findStep1Context(connection, userId) {
  const user = await basicDetailsModel.findActiveUserForUpdate(connection, userId);
  if (!user || user.status !== "active") {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid or inactive user",
      [],
      "UNAUTHORIZED",
    );
  }

  const cases = await basicDetailsModel.findCasesByUserIdForUpdate(connection, userId);
  if (cases.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "KYC case was not initialized for this user",
      [],
      "KYC_CASE_NOT_FOUND",
    );
  }
  if (cases.length > 1) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Multiple KYC cases exist for this user",
      [],
      "KYC_CASE_AMBIGUOUS",
    );
  }

  const kycCase = cases[0];
  if (kycCase.status !== "pending") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "KYC Step 1 is not available for this case",
      [],
      "KYC_CASE_NOT_EDITABLE",
    );
  }

  const step = await basicDetailsModel.findStepByCaseIdAndNumber(
    connection,
    kycCase.id,
    BASIC_DETAILS_STEP,
  );
  if (!step) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "KYC Step 1 was not initialized for this case",
      [],
      "KYC_STEP_NOT_INITIALIZED",
    );
  }
  if (step.status === "completed") {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Basic details are already verified",
      [],
      "STEP_ALREADY_COMPLETED",
    );
  }

  return { user, kycCase, step };
}

function rateHashes(secret, userId, ipAddress) {
  return {
    userRateHash: hashRateScope(secret, "user", userId),
    ipRateHash: hashRateScope(secret, "ip", ipAddress),
  };
}

async function releaseConnection(connection, rollback = false) {
  if (!connection) return;
  let canRelease = true;
  if (rollback) {
    try {
      await connection.rollback();
    } catch {
      canRelease = false;
    }
  }
  if (!canRelease && typeof connection.destroy === "function") {
    connection.destroy();
  } else {
    connection.release();
  }
}

async function requestStep1Otp(userId, ipAddress) {
  let connection;
  try {
    connection = await basicDetailsModel.getConnection();
  } catch {
    throw serviceUnavailable();
  }

  let otp;
  let challengeId;
  let issuedChallenge;
  try {
    await connection.beginTransaction();
    const { user, kycCase } = await findStep1Context(connection, userId);
    const details = getSavedBasicDetails(user, kycCase);
    if (process.env.NODE_ENV !== "development") {
      throw serviceUnavailable();
    }
    const secret = getKycOtpSecret();
    const fingerprint = detailsFingerprint(secret, userId, kycCase.id, details);
    const hashes = rateHashes(secret, userId, ipAddress);
    otp = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    challengeId = crypto.randomBytes(16).toString("hex");
    const result = await kycOtpStore.issueChallenge({
      userId,
      caseId: kycCase.id,
      stepNumber: BASIC_DETAILS_STEP,
      otpHash: hashOtp(secret, userId, kycCase.id, fingerprint, otp),
      detailsFingerprint: fingerprint,
      challengeId,
      ...hashes,
    });

    if (result.status === "cooldown") {
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        "Please wait before requesting another OTP",
        [],
        "RATE_LIMITED",
      );
    }
    if (result.status === "rate_limited") {
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        "Too many OTP requests. Try again later.",
        [],
        "RATE_LIMITED",
      );
    }
    if (result.status !== "issued") throw new Error("KYC OTP challenge could not be stored");

    issuedChallenge = { caseId: kycCase.id, challengeId };
    await connection.commit();
  } catch (error) {
    await releaseConnection(connection, true);
    connection = null;
    if (issuedChallenge) {
      await kycOtpStore.discardChallenge({
        caseId: issuedChallenge.caseId,
        stepNumber: BASIC_DETAILS_STEP,
        challengeId: issuedChallenge.challengeId,
      }).catch(() => {});
    }
    if (error instanceof ApiError) throw error;
    throw serviceUnavailable();
  } finally {
    if (connection) await releaseConnection(connection);
  }

  if (process.env.NODE_ENV === "development") {
    try {
      console.info(`[AquaPay KYC DEVELOPMENT OTP] ${otp}`);
    } catch {
      // The committed challenge remains usable if terminal output is unavailable.
    }
  }
  return { message: "OTP requested successfully" };
}

async function verifyStep1Otp(userId, otp, ipAddress) {
  let connection;
  try {
    connection = await basicDetailsModel.getConnection();
  } catch {
    throw serviceUnavailable();
  }

  let claim;
  let committed = false;
  let result;
  try {
    await connection.beginTransaction();
    const { user, kycCase } = await findStep1Context(connection, userId);
    const details = getSavedBasicDetails(user, kycCase);
    const secret = getKycOtpSecret();
    const fingerprint = detailsFingerprint(secret, userId, kycCase.id, details);
    const hashes = rateHashes(secret, userId, ipAddress);
    const claimId = crypto.randomBytes(16).toString("hex");
    const verification = await kycOtpStore.claimChallenge({
      userId,
      caseId: kycCase.id,
      stepNumber: BASIC_DETAILS_STEP,
      detailsFingerprint: fingerprint,
      claimId,
      ...hashes,
    });

    if (verification.status === "rate_limited") {
      throw new ApiError(
        httpStatus.TOO_MANY_REQUESTS,
        "Too many OTP verification attempts. Try again later.",
        [],
        "RATE_LIMITED",
      );
    }
    if (verification.status !== "claimed") throw invalidOtp();

    claim = { userId, caseId: kycCase.id, stepNumber: BASIC_DETAILS_STEP, claimId };
    const submittedHash = hashOtp(secret, userId, kycCase.id, fingerprint, otp);
    if (!secureHashEquals(verification.otpHash, submittedHash)) {
      await kycOtpStore.rejectClaim(claim);
      claim = null;
      throw invalidOtp();
    }

    const completed = await basicDetailsModel.completeStep1(connection, kycCase.id);
    if (!completed) throw new Error("KYC Step 1 completion update failed");
    const stepsCompleted = await basicDetailsModel.updateCompletedStepsCount(
      connection,
      kycCase.id,
    );
    await connection.commit();
    committed = true;
    result = { message: "Step 1 verified successfully", steps_completed: stepsCompleted };
  } catch (error) {
    await releaseConnection(connection, true);
    connection = null;

    if (claim && !committed) {
      try {
        const persistedState = await basicDetailsModel.findStepCompletionState(claim.caseId);
        if (persistedState?.status === "completed") {
          committed = true;
          result = {
            message: "Step 1 verified successfully",
            steps_completed: Number(persistedState.steps_completed || 0),
          };
          await kycOtpStore.consumeClaim(claim).catch(() => {});
        } else {
          await kycOtpStore.releaseClaim(claim);
        }
      } catch {
        // Keep the Redis lease until it expires; this fails closed if DB state is uncertain.
      }
    }

    if (committed && result) return result;
    if (error instanceof ApiError) throw error;
    throw serviceUnavailable();
  } finally {
    if (connection) await releaseConnection(connection);
  }

  try {
    await kycOtpStore.consumeClaim(claim);
  } catch {
    // MySQL is authoritative; completed Step 1 blocks retries if Redis finalization fails.
    console.error("KYC OTP finalization failed after KYC progress was committed");
  }
  return result;
}

async function saveBasicDetails(userId, { businessType, shopAddress, city, pincode }) {
  let connection;
  try {
    connection = await basicDetailsModel.getConnection();
  } catch (error) {
    logDevelopmentFailure("Basic Details database connection", error);
    throw serviceUnavailable();
  }

  try {
    await connection.beginTransaction();

    const user = await basicDetailsModel.findActiveUserForUpdate(connection, userId);
    if (!user || user.status !== "active") {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Invalid or inactive user",
        [],
        "UNAUTHORIZED",
      );
    }

    const cases = await basicDetailsModel.findCasesByUserIdForUpdate(connection, userId);
    if (cases.length === 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "KYC case was not initialized for this user",
        [],
        "KYC_CASE_NOT_FOUND",
      );
    }
    if (cases.length > 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Multiple KYC cases exist for this user",
        [],
        "KYC_CASE_AMBIGUOUS",
      );
    }

    const kycCase = cases[0];
    if (kycCase.status !== "pending") {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Basic details can only be updated while KYC is pending",
        [],
        "KYC_CASE_NOT_EDITABLE",
      );
    }

    const step1 = await basicDetailsModel.findStepByCaseIdAndNumber(
      connection,
      kycCase.id,
      1,
    );
    if (!step1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "KYC Step 1 was not initialized for this case",
        [],
        "KYC_STEP_NOT_INITIALIZED",
      );
    }

    // A saved-details edit must invalidate any OTP bound to the previous values.
    // Step 1 cannot have a challenge while still pending, so first-time saves need no Redis call.
    if (step1.status !== "pending") {
      await kycOtpStore.invalidateChallenge({
        userId,
        caseId: kycCase.id,
        stepNumber: BASIC_DETAILS_STEP,
      });
    }

    const stepReset = await basicDetailsModel.resetStep1ToInProgress(
      connection,
      kycCase.id,
    );
    if (!stepReset) throw new Error("KYC Step 1 could not be updated");

    const caseUpdated = await basicDetailsModel.updateCaseBasicDetails(
      connection,
      kycCase.id,
      businessType,
    );
    if (!caseUpdated) throw new Error("KYC case could not be updated");

    const userUpdated = await basicDetailsModel.updateUserAddress(
      connection,
      userId,
      { shopAddress, city, pincode },
    );
    if (!userUpdated) throw new Error("User address could not be updated");

    const stepsCompleted = await basicDetailsModel.countCompletedSteps(
      connection,
      kycCase.id,
    );

    await connection.commit();

    return {
      businessType,
      shopAddress,
      city,
      pincode,
      kyc: {
        status: kycCase.status,
        steps_completed: stepsCompleted,
        business_type: businessType,
      },
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error instanceof ApiError) throw error;
    logDevelopmentFailure("Basic Details save", error);
    throw serviceUnavailable();
  } finally {
    connection.release();
  }
}

const basicDetailsService = { saveBasicDetails, requestStep1Otp, verifyStep1Otp };

export { saveBasicDetails, requestStep1Otp, verifyStep1Otp };
export default basicDetailsService;
