import bankDetailsModel from "./bankDetails.model.js";
import authModel from "../../auth/auth.model.js";
import { getAuthConfig } from "../../../config/auth.js";
import { hashRateLimitBucket } from "../../../middlewares/authRateLimit.middleware.js";
import { encryptAccountNumber } from "./bankAccountEncryption.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import logger from "../../../utils/logger.js";

const BANK_DETAILS_STEP = 4;

async function getBankNameByIfsc(ifscCode) {
  let response;

  try {
    const endpoint =
      `https://codein.co.in/api/v1/ifsc/${encodeURIComponent(ifscCode)}`;

    response = await fetch(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    });
  } catch (error) {
    logKycFailure("IFSC bank-name lookup request", error);
    throw serviceUnavailable();
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    logKycFailure("IFSC bank-name lookup response parsing", error);
    throw serviceUnavailable();
  }

  if (response.status === 404) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Invalid IFSC code. Please check and try again.",
      [],
      "INVALID_IFSC",
    );
  }

  if (
    !response.ok ||
    typeof result?.bank !== "string" ||
    !result.bank.trim()
  ) {
    logKycFailure(
      "IFSC bank-name lookup response",
      new Error("Bank name missing or lookup unsuccessful"),
    );
    throw serviceUnavailable();
  }

  if (
    typeof result.ifsc !== "string" ||
    result.ifsc.toUpperCase() !== ifscCode.toUpperCase()
  ) {
    throw serviceUnavailable();
  }

  return result.bank.trim();
}

async function verifyBankAccountWithIdto(bankDetails) {
  const bankName = await getBankNameByIfsc(bankDetails.ifscCode);
  const clientId = process.env.IDTO_CLIENT_ID;
  const apiKey = process.env.IDTO_API_KEY;
  const baseUrl = process.env.IDTO_BASE_URL;

  if (!clientId || !apiKey || !baseUrl) {
    throw serviceUnavailable();
  }

  let response;

  try {
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/v2/verify/bank_verification`;

    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-ID": clientId,
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({
        account_number: bankDetails.accountNumber,
        ifsc_code: bankDetails.ifscCode,
      }),
      signal: AbortSignal.timeout(15000),
    });
  } catch (error) {
    logKycFailure("IDTO bank verification request", error);
    throw serviceUnavailable();
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    logKycFailure("IDTO bank verification response parsing", error);
    throw serviceUnavailable();
  }

  if (result?.error_code === "IDTO_202") {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Bank account details could not be verified. Please check the account number and IFSC.",
      [],
      "BANK_DETAILS_MISMATCH",
    );
  }

   if (!response.ok || result?.status !== "success") {
    logger.error("bank.idto_verification_failed", {
      httpStatus: response.status,
    });

    throw serviceUnavailable();
  }

  if (!result?.data?.account_holder_name) {
    logKycFailure(
      "IDTO bank verification response",
      new Error("Missing account-holder data"),
    );
    throw serviceUnavailable();
  }

  logger.info("bank.verification_succeeded");

return {
  accountHolderName: result.data.account_holder_name,
  bankName,
  providerReference: result.tranx_id,
};
}

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

function logKycFailure(operation, error) {
  const details = {
    errorName: error?.name || "UnknownError",
  };

  if (typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)) {
    details.code = error.code;
  }

  if (Number.isInteger(error?.errno)) {
    details.errno = error.errno;
  }

  logger.error("bank.operation_failed", { operation, ...details });
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

function sqlDate(date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function findBankDetailsContext(connection, userId) {
  const user = await bankDetailsModel.findActiveUserForUpdate(
    connection,
    userId,
  );

  if (!user || user.status !== "active") {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid or inactive user",
      [],
      "UNAUTHORIZED",
    );
  }

  const cases = await bankDetailsModel.findCasesByUserIdForUpdate(
    connection,
    userId,
  );

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
      "Bank details cannot be updated for this KYC case",
      [],
      "KYC_CASE_NOT_EDITABLE",
    );
  }

  return { user, kycCase };
}

async function claimBankVerificationAttempt(userId) {
  let connection;
  try {
    connection = await bankDetailsModel.getConnection();
  } catch (error) {
    logKycFailure("Bank verification eligibility database connection", error);
    throw serviceUnavailable();
  }

  let rollback = false;
  let attempts;
  let limit;
  let caseId;
  try {
    await connection.beginTransaction();
    const { kycCase } = await findBankDetailsContext(connection, userId);
    caseId = Number(kycCase.id);
    const panStep = await bankDetailsModel.findKycStepForUpdate(
      connection,
      kycCase.id,
      3,
    );
    const verifiedPanRecords = await bankDetailsModel.findVerifiedPanForUpdate(
      connection,
      kycCase.id,
    );

    if (panStep?.status !== "completed" || verifiedPanRecords.length !== 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Complete PAN verification before submitting bank details.",
        [],
        "PAN_PREREQUISITE_NOT_COMPLETED",
      );
    }

    const config = getAuthConfig();
    const policy = config.rateLimits.bankVerification;
    const now = Date.now();
    const windowMs = policy.windowSeconds * 1000;
    const windowStartMs = Math.floor(now / windowMs) * windowMs;
    const windowStart = sqlDate(new Date(windowStartMs));
    const expiresAt = sqlDate(new Date(windowStartMs + 2 * windowMs));
    const bucketHash = hashRateLimitBucket(
      config.rateLimitHmacSecret,
      "bankVerification",
      "case",
      String(kycCase.id),
    );

    attempts = await authModel.incrementRateLimitCounter(
      bucketHash,
      windowStart,
      expiresAt,
      connection,
    );
    limit = policy.case ?? policy.user;
    await connection.commit();
  } catch (error) {
    rollback = true;
    if (error instanceof ApiError) throw error;
    logKycFailure("Bank verification eligibility check", error);
    throw serviceUnavailable();
  } finally {
    await releaseConnection(connection, rollback);
  }

  if (attempts > limit) {
    throw new ApiError(
      httpStatus.TOO_MANY_REQUESTS,
      "Too many bank verification attempts. Try again later.",
      [],
      "RATE_LIMITED",
    );
  }

  return caseId;
}

async function saveBankDetails(userId, bankDetails) {
  // Complete eligibility checks and consume the per-case attempt budget before
  // making any paid provider request.
  const eligibleCaseId = await claimBankVerificationAttempt(userId);
  const verification = await verifyBankAccountWithIdto(bankDetails);

  let connection;

  try {
    connection = await bankDetailsModel.getConnection();
  } catch (error) {
    logKycFailure("Bank Details database connection", error);
    throw serviceUnavailable();
  }

  try {
    await connection.beginTransaction();

    // Re-check ownership, status, and prerequisites after the provider call.
    const { kycCase } = await findBankDetailsContext(connection, userId);
    if (Number(kycCase.id) !== Number(eligibleCaseId)) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "KYC application changed during bank verification.",
        [],
        "KYC_CASE_CHANGED",
      );
    }

    // Require PAN verification (Step 3) before bank verification (Step 4).
    const panStep = await bankDetailsModel.findKycStepForUpdate(
      connection,
      kycCase.id,
      3,
    );

    if (!panStep || panStep.status !== "completed") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Complete PAN verification before submitting bank details.",
        [],
        "PAN_PREREQUISITE_NOT_COMPLETED",
      );
    }

    const verifiedPanRecords = await bankDetailsModel.findVerifiedPanForUpdate(
      connection,
      kycCase.id,
    );
    if (verifiedPanRecords.length !== 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Complete PAN verification before submitting bank details.",
        [],
        "PAN_PREREQUISITE_NOT_COMPLETED",
      );
    }

    const existingAccount =
      await bankDetailsModel.findBankAccountByCaseIdForUpdate(
        connection,
        kycCase.id,
      );

    const encryptedAccountNumber = encryptAccountNumber(
      bankDetails.accountNumber,
    );

    const accountNumberLast4 = bankDetails.accountNumber.slice(-4);

    const verifiedDetails = {
      accountHolderName: verification.accountHolderName,
      bankName: verification.bankName,
      ifscCode: bankDetails.ifscCode,
      encryptedAccountNumber,
      accountNumberLast4,
      providerReference: verification.providerReference,
    };

    let accountId;

    if (existingAccount) {
      await bankDetailsModel.updateBankAccount(
        connection,
        existingAccount.id,
        kycCase.id,
        verifiedDetails,
      );

      accountId = existingAccount.id;
    } else {
      accountId = await bankDetailsModel.insertBankAccount(
        connection,
        kycCase.id,
        verifiedDetails,
      );
    }

    // Complete Step 4 inside the same transaction.
    const step4Completed = await bankDetailsModel.completeStep4(
      connection,
      kycCase.id,
    );

    if (!step4Completed) {
      throw new Error("KYC Step 4 completion update failed");
    }

    const stepsCompleted =
      await bankDetailsModel.updateCompletedStepsCount(
        connection,
        kycCase.id,
      );

    // Commit only after saving the account and completing Step 4.
    await connection.commit();

    return {
      id: accountId,
      accountHolderName: verification.accountHolderName,
      bankName: verification.bankName,
      ifscCode: bankDetails.ifscCode,
      accountNumberLast4,
      verificationStatus: "verified",
      stepNumber: BANK_DETAILS_STEP,
      steps_completed: stepsCompleted,
      message: "Bank account verified and details saved successfully.",
    };
  } catch (error) {
    await releaseConnection(connection, true);
    connection = null;

    if (error instanceof ApiError) {
      throw error;
    }

    // Detailed diagnostic logging for unexpected save/database errors.
    logKycFailure("Bank Details save", error);
    throw serviceUnavailable();
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

async function getBankDetails(userId) {
  try {
    const user = await bankDetailsModel.findActiveUser(userId);
    if (!user) {
      throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid or inactive user", [], "UNAUTHORIZED");
    }
    const kycCase = await bankDetailsModel.findCurrentCaseByUserId(userId);
    if (!kycCase) {
      throw new ApiError(httpStatus.NOT_FOUND, "KYC case was not initialized for this user", [], "KYC_CASE_NOT_FOUND");
    }
    const account = await bankDetailsModel.findBankAccountByCaseId(
      null,
      kycCase.id,
    );

    if (!account) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "Bank details have not been saved",
        [],
        "BANK_DETAILS_NOT_FOUND",
      );
    }

    return {
      accountHolderName: account.account_holder_name,
      bankName: account.bank_name,
      ifscCode: account.ifsc_code,
      accountNumberLast4: account.account_number_last4,
      verificationStatus: account.verification_status,
      verifiedAt: account.verified_at,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    logKycFailure("Bank Details retrieval", error);
    throw serviceUnavailable();
  }
}

const bankDetailsService = {
  saveBankDetails,
  getBankDetails,
};

export { saveBankDetails, getBankDetails };

export default bankDetailsService;
