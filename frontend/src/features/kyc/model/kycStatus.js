/**
 * Canonical KYC Status Policy
 */

export const KYC_STATUS = {
  PENDING: "pending",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  APPROVED: "approved",
  COMPLETED: "completed",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

/**
 * Checks if a user's KYC has been completed or submitted for underwriting review.
 * Allows access to normal user features while under review.
 */
export function isKycComplete(status) {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return ["approved", "completed", "verified", "submitted", "under_review"].includes(s);
}

/**
 * Checks if KYC is explicitly approved (not just submitted).
 */
export function isKycApproved(status) {
  if (!status) return false;
  const s = String(status).toLowerCase().trim();
  return ["approved", "completed", "verified"].includes(s);
}