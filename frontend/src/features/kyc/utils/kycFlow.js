
/**
 * AquaPay KYC Flow Utilities
 *
 * The backend is the source of truth for KYC status.
 * Never use localStorage to determine KYC progress.
 */

const KYC_STEPS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Interpret the merchant's KYC status returned by the backend.
 */
export function interpretKycStatus(data) {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid KYC status response.");
  }

  // Normalize completed step numbers.
  const completedSteps = [
    ...new Set(
      (Array.isArray(data.completedSteps) ? data.completedSteps : [])
        .map(Number)
        .filter(
          (step) =>
            Number.isInteger(step) &&
            step >= 1 &&
            step <= 7
        )
    ),
  ].sort((a, b) => a - b);

  // Merchant has not started KYC yet.
  if (data.hasCase === false) {
    return {
      status: "pending",
      view: "wizard",
      completedSteps: [],
      currentStep: 1,
    };
  }

  if (data.hasCase !== true) {
    throw new Error(
      "KYC application status is unavailable. Refresh to try again."
    );
  }

  const status = String(data.status || "").toLowerCase();

  // Admin rejected the application.
  if (status === "rejected") {
    return {
      status,
      view: "rejected",
      completedSteps,
      currentStep: 5,
    };
  }

  // Application is awaiting admin review.
  if (["submitted", "under_review"].includes(status)) {
    return {
      status,
      view: "submitted",
      completedSteps,
      currentStep: null,
    };
  }

  // Application has been approved.
  if (["approved", "completed", "verified"].includes(status)) {
    return {
      status,
      view: "approved",
      completedSteps,
      currentStep: null,
    };
  }

  if (status !== "pending") {
    throw new Error(
      "Unknown KYC status. Contact support before updating your application."
    );
  }

  // Prevent inconsistent backend progress from opening the wizard.
  if (completedSteps.includes(7)) {
    throw new Error(
      "KYC progress is inconsistent with the pending status. " +
      "Refresh or contact support; no changes were made."
    );
  }

  // Continue from the first incomplete KYC step.
  const currentStep =
    KYC_STEPS.find((step) => !completedSteps.includes(step)) || 7;

  return {
    status,
    view: "wizard",
    completedSteps,
    currentStep,
  };
}

/**
 * Restore the merchant's media upload state.
 */
export function currentMediaState(
  uploadedTypes = [],
  isStep5Completed = false
) {
  const uploadedMedia = new Set(uploadedTypes);

  const createMediaState = (type, label) => {
    const isUploaded =
      isStep5Completed || uploadedMedia.has(type);

    return {
      status: isUploaded ? "uploaded" : "idle",
      name: isUploaded ? label : "",
      error: null,
    };
  };

  return {
    selfie: createMediaState("selfie", "Signatory Photo"),
    video: createMediaState("consent_video", "Consent Video Clip"),
    shop: createMediaState("shop_image", "Commercial Premise Photo"),
  };
}
