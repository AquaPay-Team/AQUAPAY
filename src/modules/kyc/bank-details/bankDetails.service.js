import bankDetailsModel from "./bankDetails.model.js";
// import { encryptAccountNumber } from "../../../utils/bankAccountEncryption.js";
import { encryptAccountNumber } from "./bankAccountEncryption.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const BANK_DETAILS_STEP = 4;

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

function logKycFailure(operation, error) {
  const details = {};

  if (typeof error?.code === "string" && /^[A-Z0-9_]+$/.test(error.code)) {
    details.code = error.code;
  }

  if (Number.isInteger(error?.errno)) {
    details.errno = error.errno;
  }

  if (Object.keys(details).length === 0) {
    details.errorType = error?.name || "UnknownError";
  }

  console.error(`[AquaPay KYC] ${operation} failed`, details);
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

async function saveBankDetails(userId, bankDetails) {
  let connection;

  try {
    connection = await bankDetailsModel.getConnection();
  } catch (error) {
    logKycFailure("Bank Details database connection", error);
    throw serviceUnavailable();
  }

  try {
    await connection.beginTransaction();

    const { kycCase } = await findBankDetailsContext(connection, userId);

    const existingAccount =
      await bankDetailsModel.findBankAccountByCaseIdForUpdate(
        connection,
        kycCase.id,
      );

    const encryptedAccountNumber = encryptAccountNumber(
      bankDetails.accountNumber,
    );

    const accountNumberLast4 = bankDetails.accountNumber.slice(-4);

    const encryptedDetails = {
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      ifscCode: bankDetails.ifscCode,
      encryptedAccountNumber,
      accountNumberLast4,
    };

    let accountId;

    if (existingAccount) {
      await bankDetailsModel.updateBankAccount(
        connection,
        existingAccount.id,
        encryptedDetails,
      );

      accountId = existingAccount.id;
    } else {
      accountId = await bankDetailsModel.insertBankAccount(
        connection,
        kycCase.id,
        encryptedDetails,
      );
    }

    await connection.commit();

    return {
      id: accountId,
      accountHolderName: bankDetails.accountHolderName,
      bankName: bankDetails.bankName,
      ifscCode: bankDetails.ifscCode,
      accountNumberLast4,
      verificationStatus: "pending",
      stepNumber: BANK_DETAILS_STEP,
      message: "Bank details saved. Verification is pending.",
    };
  } catch (error) {
    await releaseConnection(connection, true);
    connection = null;

    if (error instanceof ApiError) {
      throw error;
    }

    logKycFailure("Bank Details save", error);
    throw serviceUnavailable();
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

async function getBankDetails(userId) {
  let connection;

  try {
    connection = await bankDetailsModel.getConnection();
    await connection.beginTransaction();

    const { kycCase } = await findBankDetailsContext(connection, userId);

    const account = await bankDetailsModel.findBankAccountByCaseId(
      connection,
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

    await connection.commit();

    return {
      accountHolderName: account.account_holder_name,
      bankName: account.bank_name,
      ifscCode: account.ifsc_code,
      accountNumberLast4: account.account_number_last4,
      verificationStatus: account.verification_status,
      verifiedAt: account.verified_at,
    };
  } catch (error) {
    if (connection) {
      await releaseConnection(connection, true);
      connection = null;
    }

    if (error instanceof ApiError) throw error;

    logKycFailure("Bank Details retrieval", error);
    throw serviceUnavailable();
  } finally {
    if (connection) {
      await releaseConnection(connection);
    }
  }
}

const bankDetailsService = {
  saveBankDetails,
  getBankDetails,
};

export { saveBankDetails, getBankDetails };

export default bankDetailsService;
