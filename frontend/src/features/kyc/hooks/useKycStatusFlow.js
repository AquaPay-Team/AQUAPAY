import { useState, useEffect } from "react";
import { toast } from "sonner";
import { parseApiError } from "@/utils/errorHandler";
import { isAdminRole } from "@/constants/roles";
import { interpretKycStatus, currentMediaState } from "../utils/kycFlow";
import { updateCachedUser } from "@/features/auth/session";
import {
  getKycStatus,
  getSubmissionStatus,
  restartRejectedKyc,
  getMediaUploadStatus,
  getBankDetails,
} from "@/api/kyc.api";

export function useKycStatusFlow({
  storedUser,
  navigate,
  setFormData,
  setPanVerified,
  setAadhaarVerified,
  setSessionStatus,
  syncAadhaarVerifiedName,
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [kycStatus, setKycStatus] = useState(null);
  const [rejectionReason, setRejectionReason] = useState(null);
  const [isLoadingKycStatus, setIsLoadingKycStatus] = useState(true);
  const [kycStatusError, setKycStatusError] = useState("");
  const [isRestarting, setIsRestarting] = useState(false);
  const [refreshStatusKey, setRefreshStatusKey] = useState(0);
  const restartFlagKey = storedUser?.id ? `aquapay_kyc_restarted_${storedUser.id}` : null;
  const [isRestartFlow, setIsRestartFlow] = useState(() => {
    try {
      return Boolean(restartFlagKey && localStorage.getItem(restartFlagKey) === "true");
    } catch {
      return false;
    }
  });
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState(storedUser?.kyc?.caseId || "");
  const [uploadStates, setUploadStates] = useState({
    selfie: { status: "idle", name: "", error: null },
    video: { status: "idle", name: "", error: null },
    shop: { status: "idle", name: "", error: null },
  });

  useEffect(() => {
    if (storedUser && isAdminRole(storedUser)) {
      navigate("/admin/dashboard", { replace: true });
      return;
    }
    const activeRef = { isCurrent: true };
    async function fetchStatus() {
      setIsLoadingKycStatus(true);
      setKycStatusError("");
      try {
        const response = await getKycStatus();
        if (!activeRef.isCurrent) return;
        const state = interpretKycStatus(response?.data);
        setKycStatus(state.status);
        setCompletedSteps(state.completedSteps);
        setCurrentStep(state.currentStep || 1);

        if (response?.data?.hasCase === false) {
          setIsSubmitted(false);
          setRejectionReason(null);
          setIsRestartFlow(false);
          return;
        }

        const submission = (await getSubmissionStatus())?.data;
        if (!activeRef.isCurrent) return;
        if (!submission || String(submission.status).toLowerCase() !== state.status) {
          throw new Error("KYC review status changed while loading. Refresh to get the latest result.");
        }
        setRejectionReason(state.status === "rejected" ? submission.rejectionReason || null : null);

        if (state.view === "approved") {
          if (restartFlagKey) localStorage.removeItem(restartFlagKey);
          updateCachedUser({
            kyc: { ...(storedUser?.kyc || {}), status: "approved" },
            kyc_status: "approved",
          });
          navigate("/user/dashboard", { replace: true });
          return;
        }
        if (state.view === "submitted") {
          if (restartFlagKey) localStorage.removeItem(restartFlagKey);
          updateCachedUser({
            kyc: { ...(storedUser?.kyc || {}), status: "submitted" },
            kyc_status: "submitted",
          });
          setIsSubmitted(true);
          setIsRestartFlow(false);
          setReferenceId(submission.caseId ? `AQP-${String(submission.caseId).padStart(6, "0")}` : "");
          return;
        }
        setIsSubmitted(false);
        if (state.view === "rejected") {
          if (restartFlagKey) localStorage.removeItem(restartFlagKey);
          setIsRestartFlow(false);
          setUploadStates(currentMediaState());
          setFormData((prev) => ({
            ...prev,
            selfieFile: null,
            videoFile: null,
            shopPhotoFile: null,
            agreedTerms: false,
            agreedDataProcessing: false,
            agreedCreditCheck: false,
          }));
          return;
        }

        let media = null;
        try {
          const mediaResponse = await getMediaUploadStatus();
          media = mediaResponse?.data;
          if (!media || String(media.status).toLowerCase() !== state.status) {
            throw new Error("Media status changed. Refresh to continue safely.");
          }
        } catch (error) {
          if (error?.response?.status !== 404) {
            throw error;
          }
          console.warn("Media status API unavailable; using verified KYC step progress.");
        }

        if (!activeRef.isCurrent) return;

        const restarted = media
          ? Boolean(media.isRestartAttempt && state.status === "pending")
          : Boolean(
              restartFlagKey &&
                localStorage.getItem(restartFlagKey) === "true" &&
                state.status === "pending"
            );

        setIsRestartFlow(restarted);

        if (restartFlagKey && media) {
          if (restarted) {
            localStorage.setItem(restartFlagKey, "true");
          } else {
            localStorage.removeItem(restartFlagKey);
          }
        }

        setUploadStates(
          currentMediaState(
            media?.uploadedTypes || [],
            state.completedSteps.includes(5)
          )
        );

        setFormData((prev) => ({
          ...prev,
          agreedTerms: state.completedSteps.includes(6),
        }));

        if (state.completedSteps.includes(2)) {
          setAadhaarVerified(true);
          setSessionStatus("verified");
          await syncAadhaarVerifiedName(
            response?.data?.aadhaar?.verifiedName,
            response?.data?.aadhaar?.maskedIdentifier
          );
        }

        if (state.completedSteps.includes(3)) {
          setPanVerified(true);
          const verifiedPan = response?.data?.pan;
          const mask = verifiedPan?.maskedIdentifier;
          const validMask =
            typeof mask === "string" && /^X{6}[0-9]{3}[A-Z]$/.test(mask);

          setFormData((prev) => ({
            ...prev,
            panMasked: validMask ? mask : "",
            ...(verifiedPan?.verifiedName
              ? { panName: verifiedPan.verifiedName }
              : {}),
          }));
        }

        if (state.completedSteps.includes(4)) {
          try {
            const bank = (await getBankDetails())?.data;
            if (activeRef.isCurrent && bank) {
              setFormData((prev) => ({
                ...prev,
                bankName: bank.bankName || prev.bankName,
                ifscCode: bank.ifscCode || prev.ifscCode,
                accountNumber: `••••••••${bank.accountNumberLast4 || "XXXX"}`,
                confirmAccountNumber: `••••••••${bank.accountNumberLast4 || "XXXX"}`,
              }));
            }
          } catch {
            /* Bank details are informational for previously verified Step 4 */
          }
        }
      } catch (error) {
        if (activeRef.isCurrent) {
          setKycStatusError(
            error?.message ||
              parseApiError(error).message ||
              "Unable to load KYC status."
          );
        }
      } finally {
        if (activeRef.isCurrent) setIsLoadingKycStatus(false);
      }
    }
    fetchStatus();
    return () => {
      activeRef.isCurrent = false;
    };
  }, [
    navigate,
    syncAadhaarVerifiedName,
    refreshStatusKey,
    storedUser,
    restartFlagKey,
    setAadhaarVerified,
    setSessionStatus,
    setFormData,
    setPanVerified,
  ]);

  const handleRefreshStatus = () => setRefreshStatusKey((value) => value + 1);

  const handleRestartRejectedKyc = async () => {
    if (isRestarting) return;
    setIsRestarting(true);
    try {
      const response = await restartRejectedKyc();
      if (
        response?.data?.status !== "pending" ||
        Number(response?.data?.currentStep) !== 5
      ) {
        throw new Error(
          "The server did not confirm a restart at Step 5. Refresh KYC status before continuing."
        );
      }

      setKycStatus("pending");
      setIsSubmitted(false);
      setRejectionReason(null);
      setCurrentStep(5);
      setCompletedSteps([1, 2, 3, 4]);
      setUploadStates({
        selfie: { status: "idle", name: "", error: null },
        video: { status: "idle", name: "", error: null },
        shop: { status: "idle", name: "", error: null },
      });
      setFormData((prev) => ({
        ...prev,
        selfieFile: null,
        videoFile: null,
        shopPhotoFile: null,
        agreedTerms: false,
        agreedDataProcessing: false,
        agreedCreditCheck: false,
      }));
      setIsRestartFlow(true);
      if (restartFlagKey) localStorage.setItem(restartFlagKey, "true");
      try {
        const user = JSON.parse(localStorage.getItem("user") || "null");
        if (user) {
          user.kyc = { ...(user.kyc || {}), status: "pending", currentStep: 5 };
          localStorage.setItem("user", JSON.stringify(user));
          window.dispatchEvent(
            new CustomEvent("aquapay:user_updated", { detail: user })
          );
        }
      } catch {
        // The next server check remains the source of truth.
      }
      toast.success("KYC reopened. Please upload all three fresh media files.");
      window.scrollTo({ top: 0, behavior: "smooth" });
      handleRefreshStatus();
    } catch (err) {
      toast.error(parseApiError(err).message || "Could not restart KYC.");
      handleRefreshStatus();
    } finally {
      setIsRestarting(false);
    }
  };

  return {
    currentStep,
    setCurrentStep,
    completedSteps,
    setCompletedSteps,
    kycStatus,
    setKycStatus,
    rejectionReason,
    isLoadingKycStatus,
    kycStatusError,
    isRestarting,
    isRestartFlow,
    setIsRestartFlow,
    isSubmitted,
    setIsSubmitted,
    referenceId,
    setReferenceId,
    uploadStates,
    setUploadStates,
    restartFlagKey,
    handleRefreshStatus,
    handleRestartRejectedKyc,
  };
}
