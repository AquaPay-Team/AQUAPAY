import submissionModel from "./submission.model.js";
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import {
  DEFAULT_AGREEMENT_CODE,
  DEFAULT_AGREEMENT_VERSION,
} from "../agreement/agreement.service.js";
import logger from "../../../utils/logger.js";

const REQUIRED_STEPS = [1, 2, 3, 4, 5, 6];

const STEP_NAMES = Object.freeze({
  1: "Basic Details & Contact OTP",
  2: "Aadhaar Document Verification",
  3: "PAN Document Verification",
  4: "Bank Account Details",
  5: "Media Uploads (Shop image, Selfie, Video)",
  6: "Agent Agreement Acceptance",
  7: "Final Submission Confirmation",
});

const REQUIRED_MEDIA_TYPES = ["shop_image", "selfie", "consent_video"];
const REQUIRED_VERIFICATION_PROVIDERS = Object.freeze({
  aadhaar: "idto_digilocker_v1",
  pan: "idto_pan_detailed_v2",
});

function validVerificationEvidence(record, type) {
  if (
    !record || record.verification_type !== type ||
    record.provider !== REQUIRED_VERIFICATION_PROVIDERS[type] ||
    typeof record.verified_name !== "string" ||
    record.verified_name.trim().length === 0 ||
    record.verified_name.length > 150 ||
    /[\u0000-\u001f\u007f]/.test(record.verified_name) ||
    typeof record.masked_identifier !== "string" ||
    record.masked_identifier.length < 4 || record.masked_identifier.length > 32 ||
    /[\u0000-\u001f\u007f]/.test(record.masked_identifier) ||
    record.has_encrypted_identity !== 1
  ) return false;

  if (type === "aadhaar" && /^\d{12}$/.test(record.masked_identifier)) return false;
  return true;
}

function missingSubmissionEvidenceSteps(evidence) {
  const missing = [];
  const basic = evidence?.basicDetails;
  if (
    !basic ||
    !String(basic.business_type || "").trim() ||
    !String(basic.address || "").trim() ||
    !String(basic.city || "").trim() ||
    !String(basic.pincode || "").trim()
  ) missing.push(1);

  const verificationRecords = evidence?.verificationRecords || [];
  for (const [type, stepNumber] of [["aadhaar", 2], ["pan", 3]]) {
    const records = verificationRecords.filter((record) => record.verification_type === type);
    if (records.length !== 1 || !validVerificationEvidence(records[0], type)) {
      missing.push(stepNumber);
    }
  }

  const bankAccounts = evidence?.bankAccounts || [];
  if (
    bankAccounts.length !== 1 ||
    bankAccounts[0]?.verification_status !== "verified" ||
    !Buffer.isBuffer(bankAccounts[0]?.account_number_encrypted) ||
    bankAccounts[0].account_number_encrypted.length === 0
  ) missing.push(4);

  const latestMedia = new Map(
    (evidence?.latestMedia || []).map((row) => [row.asset_type, row.status]),
  );
  if (REQUIRED_MEDIA_TYPES.some((type) => !["uploaded", "verified"].includes(latestMedia.get(type)))) {
    missing.push(5);
  }

  if (!evidence?.agreementAcceptance) missing.push(6);
  return missing;
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

async function getSubmissionStatus(userId) {
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const user = await submissionModel.findActiveUser(userId);
  if (!user || user.status !== "active") {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Invalid or inactive user",
      [],
      "UNAUTHORIZED",
    );
  }

  const cases = await submissionModel.findCasesByUserId(userId);
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
  const steps = await submissionModel.findStepsByCaseId(null, kycCase.id);

  const completedStepNumbers = new Set(
    steps
      .filter((s) => s.status === "completed")
      .map((s) => Number(s.step_number)),
  );

  const incompleteSteps = REQUIRED_STEPS
    .filter((stepNum) => !completedStepNumbers.has(stepNum))
    .map((stepNum) => ({
      stepNumber: stepNum,
      name: STEP_NAMES[stepNum] || `Step ${stepNum}`,
    }));

  const isReadyForSubmission =
    incompleteSteps.length === 0 && kycCase.status === "pending";

  const isSubmitted = ["submitted", "under_review", "approved"].includes(
    kycCase.status,
  );

  return {
    caseId: kycCase.id,
    status: kycCase.status,
    submittedAt: kycCase.submitted_at || null,
    reviewedAt: kycCase.reviewed_at || null,
    rejectionReason: kycCase.rejection_reason || null,
    steps_completed: Number(kycCase.steps_completed || 0),
    isReadyForSubmission,
    isSubmitted,
    incompleteSteps,
    message: isSubmitted
      ? "KYC application has been submitted and is under verification."
      : isReadyForSubmission
        ? "All prerequisites completed. Ready for final submission."
        : "Prerequisite KYC steps are incomplete.",
  };
}

async function submitKycApplication(userId, { notes } = {}) {
  if (!userId) {
    throw new ApiError(
      httpStatus.UNAUTHORIZED,
      "Authentication required",
      [],
      "UNAUTHORIZED",
    );
  }

  const connection = await submissionModel.getConnection();
  let rollback = false;

  try {
    await connection.beginTransaction();

    const user = await submissionModel.findActiveUserForUpdate(connection, userId);
    if (!user || user.status !== "active") {
      throw new ApiError(
        httpStatus.UNAUTHORIZED,
        "Invalid or inactive user",
        [],
        "UNAUTHORIZED",
      );
    }

    const cases = await submissionModel.findCasesByUserIdForUpdate(connection, userId);
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

    // Idempotent handling for already submitted cases
    if (kycCase.status === "submitted" || kycCase.status === "under_review") {
      await connection.commit();
      return {
        alreadySubmitted: true,
        caseId: kycCase.id,
        status: kycCase.status,
        submittedAt: kycCase.submitted_at
          ? new Date(kycCase.submitted_at).toISOString()
          : null,
        steps_completed: Number(kycCase.steps_completed || 7),
        message: "KYC application has already been submitted and is under verification.",
      };
    }

    if (kycCase.status === "approved") {
      throw new ApiError(
        httpStatus.CONFLICT,
        "KYC application is already approved.",
        [],
        "KYC_ALREADY_APPROVED",
      );
    }

    if (kycCase.status !== "pending") {
      throw new ApiError(
        httpStatus.CONFLICT,
        `KYC application cannot be submitted in status: ${kycCase.status}.`,
        [],
        "KYC_CASE_NOT_EDITABLE",
      );
    }

    // Check all required steps 1 to 6
    const steps = await submissionModel.findStepsByCaseId(connection, kycCase.id);

    const completedStepNumbers = new Set(
      steps
        .filter((s) => s.status === "completed")
        .map((s) => Number(s.step_number)),
    );

    const incomplete = REQUIRED_STEPS.filter(
      (stepNum) => !completedStepNumbers.has(stepNum),
    );

    if (incomplete.length > 0) {
      const incompleteDetails = incomplete.map((num) => ({
        stepNumber: num,
        name: STEP_NAMES[num] || `Step ${num}`,
      }));

      const names = incompleteDetails.map((d) => d.name).join(", ");

      throw new ApiError(
        httpStatus.CONFLICT,
        `Cannot submit KYC. Please complete previous steps first: ${names}`,
        incompleteDetails,
        "INCOMPLETE_KYC_STEPS",
      );
    }

    // Step flags are user-facing progress only. Revalidate durable evidence
    // while the case is locked before final submission.
    const evidence = await submissionModel.findSubmissionEvidence(
      connection,
      userId,
      kycCase.id,
      DEFAULT_AGREEMENT_CODE,
      DEFAULT_AGREEMENT_VERSION,
    );
    const missingEvidence = missingSubmissionEvidenceSteps(evidence);
    if (missingEvidence.length > 0) {
      const details = missingEvidence.map((stepNumber) => ({
        stepNumber,
        name: STEP_NAMES[stepNumber],
      }));
      throw new ApiError(
        httpStatus.CONFLICT,
        "Cannot submit KYC because required verification evidence is missing or invalid.",
        details,
        "INCOMPLETE_KYC_EVIDENCE",
      );
    }

    const submittedAt = new Date();

    // 1. Update KYC Case to 'submitted'
    await submissionModel.submitKycCase(connection, kycCase.id, submittedAt);

    // 2. Complete Step 7
    await submissionModel.completeStep7(connection, kycCase.id);

    // 3. Update total steps completed
    const stepsCompleted = await submissionModel.updateCompletedStepsCount(
      connection,
      kycCase.id,
    );

    // 4. Log status history audit trail
    await submissionModel.insertStatusHistory(connection, {
      caseId: kycCase.id,
      oldStatus: kycCase.status,
      newStatus: "submitted",
      actorUserId: user.id,
      reason: notes || "Final KYC application submitted by agent",
    });

    await connection.commit();

    return {
      alreadySubmitted: false,
      caseId: kycCase.id,
      status: "submitted",
      submittedAt: submittedAt.toISOString(),
      steps_completed: stepsCompleted,
      message: "Your KYC application has been successfully submitted and is under verification.",
    };
  } catch (error) {
    rollback = true;

    if (error instanceof ApiError) {
      throw error;
    }

    logger.error("kyc.submission_failed", {
      errorName: typeof error?.name === "string" ? error.name : "UnknownError",
      errorCode: typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)
        ? error.code
        : undefined,
    });
    throw serviceUnavailable();
  } finally {
    await releaseConnection(connection, rollback);
  }
}

const submissionService = {
  REQUIRED_STEPS,
  STEP_NAMES,
  validVerificationEvidence,
  missingSubmissionEvidenceSteps,
  getSubmissionStatus,
  submitKycApplication,
};

export {
  REQUIRED_STEPS,
  STEP_NAMES,
  validVerificationEvidence,
  missingSubmissionEvidenceSteps,
  getSubmissionStatus,
  submitKycApplication,
};

export default submissionService;

