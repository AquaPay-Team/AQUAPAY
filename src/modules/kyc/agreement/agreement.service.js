import agreementModel from "./agreement.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";

const DEFAULT_AGREEMENT_CODE = "AQUAPAY_AGENT_AGREEMENT";
const DEFAULT_AGREEMENT_VERSION = "v1.0";
const AGREEMENT_TITLE = "AquaPay Agent Agreement";

const AGREEMENT_CLAUSES = [
  'I hereby undertake to use Payment Gateway services with my "user ID" only after agreeing to the online agreement on AquaPay portal.',
  "I hereby declare that I will use my own Credit Card/Debit Card/Net banking/UPI only.",
  "In case of any chargeback or fraud transaction claim, AquaPay reserves the right to recover the amount.",
  "AquaPay may suspend settlement during suspicious activities.",
  "I agree to use services only for legal business purposes.",
  "I will not tamper, hack, or misuse the services.",
  "AquaPay shall not be liable for any damages arising from misuse.",
  "I confirm all information provided by me is correct.",
  "I do not have any criminal background.",
  "This declaration is made voluntarily and knowingly.",
];

function formatDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function generateAgreementContent({ agentName, city, mobile, dateString }) {
  const place = city ? `${city} City` : "India";
  const date = dateString || formatDate();

  return `
AquaPay Agent Agreement

This Agent Agreement ("Agreement") is made on this ${date} by and between:

AquaPay, a company incorporated under the Companies Act, 2013, hereinafter referred to as the "Company".

AND

${agentName || "Agent"}, residing at ${place}, hereinafter referred to as the "Agent"

1. I hereby undertake to use Payment Gateway services with my "user ID" only after agreeing to the online agreement on AquaPay portal.
2. I hereby declare that I will use my own Credit Card/Debit Card/Net banking/UPI only.
3. In case of any chargeback or fraud transaction claim, AquaPay reserves the right to recover the amount.
4. AquaPay may suspend settlement during suspicious activities.
5. I agree to use services only for legal business purposes.
6. I will not tamper, hack, or misuse the services.
7. AquaPay shall not be liable for any damages arising from misuse.
8. I confirm all information provided by me is correct.
9. I do not have any criminal background.
10. This declaration is made voluntarily and knowingly.

Date: ${date}
Place: ${place}
Signature Name: ${agentName || ""}
Mobile Number: ${mobile || ""}

This is a system generated document. No physical signature required.
`.trim();
}

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

async function releaseConnection(connection, rollback = false) {
  if (!connection) return;

  try {
    if (rollback) {
      await connection.rollback();
    }
    connection.release();
  } catch (error) {
    try {
      connection.destroy();
    } catch {
      // Ignored
    }
  }
}

async function getAgreementDetails(userId) {
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const user = await agreementModel.findActiveUser(userId);
  if (!user || user.status !== "active") {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid or inactive user",
      [],
      "UNAUTHORIZED",
    );
  }

  const cases = await agreementModel.findCasesByUserId(userId);
  if (!cases || cases.length === 0) {
    throw new ApiError(
      httpStatus.NOT_FOUND,
      "KYC application not found.",
      [],
      "KYC_CASE_NOT_FOUND",
    );
  }

  if (cases.length > 1) {
    throw new ApiError(
      httpStatus.CONFLICT,
      "Multiple KYC applications found. Contact support.",
      [],
      "KYC_CASE_AMBIGUOUS",
    );
  }

  const kycCase = cases[0];

  const existingAcceptance = await agreementModel.findAgreementAcceptance(
    null,
    kycCase.id,
    DEFAULT_AGREEMENT_CODE,
    DEFAULT_AGREEMENT_VERSION,
  );

  const acceptedDate = existingAcceptance?.accepted_at
    ? formatDate(new Date(existingAcceptance.accepted_at))
    : formatDate();

  const place = user.city ? `${user.city} City` : "India";

  const content = generateAgreementContent({
    agentName: user.name,
    city: user.city,
    mobile: user.mobile,
    dateString: acceptedDate,
  });

  return {
    agreementCode: DEFAULT_AGREEMENT_CODE,
    agreementVersion: DEFAULT_AGREEMENT_VERSION,
    title: AGREEMENT_TITLE,
    content,
    clauses: AGREEMENT_CLAUSES,
    signSection: {
      date: acceptedDate,
      place,
      signatureName: user.name,
      mobileNumber: user.mobile,
      disclaimer: "This is a system generated document. No physical signature required.",
    },
    agentDetails: {
      userId: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      role: user.role_name || user.role_slug,
      shopname: user.shopname,
      address: user.address,
      city: user.city,
      state: user.state,
      pincode: user.pincode,
      businessType: kycCase.business_type,
    },
    isAccepted: !!existingAcceptance,
    acceptedAt: existingAcceptance?.accepted_at || null,
  };
}


async function acceptAgreement(
  userId,
  { agreementCode, agreementVersion, accepted } = {},
) {
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  if (accepted !== true) {
    throw new ApiError(
      httpStatus.BAD_REQUEST,
      "Agreement terms and conditions must be accepted",
      [],
      "VALIDATION_ERROR",
    );
  }

  const code = agreementCode || DEFAULT_AGREEMENT_CODE;
  const version = agreementVersion || DEFAULT_AGREEMENT_VERSION;

  const connection = await agreementModel.getConnection();
  let rollback = false;

  try {
    await connection.beginTransaction();

    const user = await agreementModel.findActiveUserForUpdate(
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

    const cases = await agreementModel.findCasesByUserIdForUpdate(
      connection,
      userId,
    );

    if (!cases || cases.length === 0) {
      throw new ApiError(
        httpStatus.NOT_FOUND,
        "KYC application not found.",
        [],
        "KYC_CASE_NOT_FOUND",
      );
    }

    if (cases.length > 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Multiple KYC applications found. Contact support.",
        [],
        "KYC_CASE_AMBIGUOUS",
      );
    }

    const kycCase = cases[0];

    if (kycCase.status !== "pending") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "This KYC application cannot be modified.",
        [],
        "KYC_CASE_NOT_EDITABLE",
      );
    }

    // Step 6 requires Step 5 (Media Upload) to be completed.
    const step5 = await agreementModel.findStepByCaseIdAndNumber(
      connection,
      kycCase.id,
      5,
    );

    if (!step5 || step5.status !== "completed") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Complete all required media uploads before accepting the agreement.",
        [],
        "KYC_PREREQUISITE_NOT_COMPLETED",
      );
    }

    // Check whether Step 6 is initialized.
    const step6 = await agreementModel.findStepByCaseIdAndNumber(
      connection,
      kycCase.id,
      6,
    );

    if (!step6) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Agreement acceptance step is not initialized.",
        [],
        "KYC_STEP_NOT_INITIALIZED",
      );
    }

    if (step6.status === "completed") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Agreement step is already completed.",
        [],
        "KYC_STEP_ALREADY_COMPLETED",
      );
    }

    const acceptedAt = new Date();

    await agreementModel.insertAgreementAcceptance(connection, {
      caseId: kycCase.id,
      agreementCode: code,
      agreementVersion: version,
      acceptedAt,
    });

    const step6Completed = await agreementModel.completeStep6(
      connection,
      kycCase.id,
    );

    if (!step6Completed) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Unable to complete agreement acceptance step.",
        [],
        "KYC_STEP_COMPLETION_FAILED",
      );
    }

    const stepsCompleted = await agreementModel.updateCompletedStepsCount(
      connection,
      kycCase.id,
    );

    await connection.commit();

    return {
      accepted: true,
      agreementCode: code,
      agreementVersion: version,
      acceptedAt: acceptedAt.toISOString(),
      steps_completed: stepsCompleted,
    };
  } catch (error) {
    rollback = true;

    if (error instanceof ApiError) {
      throw error;
    }

    throw serviceUnavailable();
  } finally {
    await releaseConnection(connection, rollback);
  }
}

const agreementService = {
  DEFAULT_AGREEMENT_CODE,
  DEFAULT_AGREEMENT_VERSION,
  AGREEMENT_TITLE,
  AGREEMENT_CLAUSES,
  generateAgreementContent,
  getAgreementDetails,
  acceptAgreement,
};

export {
  DEFAULT_AGREEMENT_CODE,
  DEFAULT_AGREEMENT_VERSION,
  AGREEMENT_TITLE,
  AGREEMENT_CLAUSES,
  generateAgreementContent,
  getAgreementDetails,
  acceptAgreement,
};

export default agreementService;
