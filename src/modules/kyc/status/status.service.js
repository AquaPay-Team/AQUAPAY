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
      kyc: null,
      currentStep: null,
      completedSteps: [],
      developmentUnverifiedSteps: [],
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
  let developmentUnverifiedRows;
  try {
    steps = await statusModel.findStepsByCaseId(kycCase.id);
    developmentUnverifiedRows = await statusModel.findDevelopmentUnverifiedVerificationsByCaseId(kycCase.id);
  } catch {
    throw serviceUnavailable();
  }

  const completedSteps = steps
    .filter((step) => step.status === "completed")
    .map((step) => Number(step.step_number));
  const currentStepRow = steps.find((step) => step.status !== "completed") || null;
  const verificationSteps = { aadhaar: 2, pan: 3 };
  const developmentUnverifiedSteps = developmentUnverifiedRows
    .map((row) => verificationSteps[row.verification_type])
    .filter(Number.isInteger);

  return {
    hasCase: true,
    kyc: {
      status: kycCase.status,
      steps_completed: Number(kycCase.steps_completed || 0),
      business_type: kycCase.business_type,
    },
    currentStep: currentStepRow ? Number(currentStepRow.step_number) : null,
    completedSteps,
    developmentUnverifiedSteps,
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
