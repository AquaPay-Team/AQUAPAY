
import ApiError from "../../../utils/ApiError.js";
import httpStatus from "../../../utils/httpStatus.js";
import statusModel from "./status.model.js";

function serviceUnavailable() {
  return new ApiError(
    httpStatus.SERVICE_UNAVAILABLE,
    "KYC service is temporarily unavailable",
    [],
    "SERVICE_UNAVAILABLE",
  );
}

async function getKycStatus(userId) {
  let cases;

  try {
    cases = await statusModel.findCasesByUserId(userId);
  } catch {
    throw serviceUnavailable();
  }

  if (cases.length === 0) {
    return {
      hasCase: false,
      status: null,
      currentStep: null,
      completedSteps: [],
      currentStepDetails: null,
    };
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
  let steps;

  try {
    steps = await statusModel.findStepsByCaseId(kycCase.id);
  } catch {
    throw serviceUnavailable();
  }

  const completedSteps = steps
    .filter((step) => step.status === "completed")
    .map((step) => Number(step.step_number));

  const currentStepRow =
    steps.find((step) => step.status !== "completed") || null;

  // Aadhaar completion is preserved across KYC rejection/restart. Only read
  // its display data after Step 2 has actually been completed.
  let aadhaar = null;
  if (completedSteps.includes(2)) {
    let records;
    try {
      records = await statusModel.findVerifiedAadhaarByCaseId(kycCase.id);
    } catch {
      throw serviceUnavailable();
    }

    if (records.length > 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Multiple verified Aadhaar records exist for this KYC case",
        [],
        "AADHAAR_VERIFICATION_AMBIGUOUS",
      );
    }

    const record = records[0];
    // AquaPay persists masked values such as XXXXXX1234. Fail closed if a
    // record unexpectedly contains a full number or any unknown format.
    const match = typeof record?.masked_identifier === "string"
      ? /^[xX*]{4,8}(\d{4})$/.exec(record.masked_identifier)
      : null;

    if (match) {
      aadhaar = {
        maskedIdentifier: `•••• •••• ${match[1]}`,
        verifiedName: typeof record.verified_name === "string" &&
          record.verified_name.trim().length <= 100
          ? record.verified_name.trim() || null
          : null,
      };
    }
  }

  // Restore only a verified PAN's final four characters. Never return a
  // complete PAN or infer verification from a cached browser value.
  let pan = null;
  if (completedSteps.includes(3)) {
    let records;
    try {
      records = await statusModel.findVerifiedPanByCaseId(kycCase.id);
    } catch {
      throw serviceUnavailable();
    }

    if (records.length > 1) {
      throw new ApiError(
        httpStatus.CONFLICT,
        "Multiple verified PAN records exist for this KYC case",
        [],
        "PAN_VERIFICATION_AMBIGUOUS",
      );
    }

    const record = records[0];
    const match = typeof record?.masked_identifier === "string"
      ? /^[xX*]{6}([0-9]{3}[A-Z])$/.exec(record.masked_identifier)
      : null;

    if (match) {
      pan = {
        maskedIdentifier: `XXXXXX${match[1]}`,
        verifiedName: typeof record.verified_name === "string" &&
          record.verified_name.trim().length <= 100
          ? record.verified_name.trim() || null
          : null,
      };
    }
  }

  return {
    hasCase: true,
    status: kycCase.status,
    ...(aadhaar ? { aadhaar } : {}),
    ...(pan ? { pan } : {}),
    currentStep: currentStepRow
      ? Number(currentStepRow.step_number)
      : null,
    completedSteps,
    currentStepDetails: currentStepRow
      ? {
          stepNumber: Number(currentStepRow.step_number),
          status: currentStepRow.status,
          completedAt: currentStepRow.completed_at || null,
        }
      : null,
  };
}

const statusService = { getKycStatus };

export { getKycStatus };
export default statusService;
