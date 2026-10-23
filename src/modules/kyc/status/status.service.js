import statusModel from "./status.model.js";
import ApiError from "../../../utils/ApiError.js";
import { StatusCache } from "./statusCache.js";

async function getStatus(userId) {
  const cache = statusService._cache;
  const cacheKey = String(userId);

  const cached = cache.get(cacheKey);
  if (cached !== undefined) {
    return cached;
  }

  let kycCase;

  try {
    kycCase = await statusModel.findCaseByUserId(userId);
  } catch {
    throw new ApiError(503, "KYC service is temporarily unavailable", "SERVICE_UNAVAILABLE");
  }

  if (!kycCase) {
    const result = { hasCase: false, case: null };
    cache.set(cacheKey, result);
    return result;
  }

  let steps;

  try {
    steps = await statusModel.findStepsByCaseId(kycCase.id);
  } catch {
    throw new ApiError(503, "KYC service is temporarily unavailable", "SERVICE_UNAVAILABLE");
  }

  const result = {
    hasCase: true,
    case: {
      status: kycCase.status,
      currentStep: kycCase.current_step,
      submittedAt: kycCase.submitted_at || null,
      reviewedAt: kycCase.reviewed_at || null,
      createdAt: kycCase.created_at,
      steps: steps.map((s) => ({
        stepNumber: s.step_number,
        status: s.status,
        completedAt: s.completed_at || null,
      })),
    },
  };

  cache.set(cacheKey, result);
  return result;
}

/**
 * Invalidate one user's cached KYC status.
 * Call after any successful KYC write operation.
 */
function invalidateStatus(userId) {
  statusService._cache.invalidate(String(userId));
}

const statusService = {
  getStatus,
  invalidateStatus,
  /** Exposed for testing only. */
  _cache: new StatusCache(),
};

export { getStatus, invalidateStatus };
export default statusService;
