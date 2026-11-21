import { useState, useRef, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { parseApiError } from "@/utils/errorHandler";
import { getCurrentUser } from "@/api/auth.api";
import {
  getKycStatus,
  initiateAadhaarVerification,
  getAadhaarVerificationStatus,
} from "@/api/kyc.api";

export function useAadhaarSession({ setFormData, setCompletedSteps, setCurrentStep }) {
  const popupWindowRef = useRef(null);
  const pollIntervalRef = useRef(null);

  const [digilockerSessionId, setDigilockerSessionId] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [sessionStatus, setSessionStatus] = useState("idle");
  const [aadhaarErrorMessage, setAadhaarErrorMessage] = useState("");
  const [isInitiatingDigilocker, setIsInitiatingDigilocker] = useState(false);
  const [isCheckingAadhaarStatus, setIsCheckingAadhaarStatus] = useState(false);
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  const [aadhaarVerifiedData, setAadhaarVerifiedData] = useState({});

  // Whitelisted origins for DigiLocker / IDTO postMessage
  const getExpectedOrigins = useCallback(() => {
    const list = [window.location.origin];
    try {
      const apiBase = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";
      const apiUrl = new URL(apiBase);
      list.push(apiUrl.origin);
    } catch {}
    list.push(
      "https://idto.in",
      "https://digilocker.meripehchaan.gov.in",
      "https://meripehchaan.gov.in"
    );
    return list;
  }, []);

  // Synchronize verified legal name from Aadhaar
  const syncAadhaarVerifiedName = useCallback(
    async (directVerifiedName, maskedId) => {
      let finalName = directVerifiedName;
      let verifiedMaskedId = maskedId;

      if (!verifiedMaskedId || !finalName) {
        try {
          const kycResponse = await getKycStatus();
          const kycData = kycResponse?.data;
          if (kycData?.hasCase && kycData.completedSteps?.includes(2)) {
            finalName = finalName || kycData.aadhaar?.verifiedName;
            verifiedMaskedId = verifiedMaskedId || kycData.aadhaar?.maskedIdentifier;
          }
        } catch {}
      }

      if (!finalName) {
        try {
          const meRes = await getCurrentUser();
          finalName = meRes?.data?.name || null;
        } catch {}
      }

      let last4 = "";
      if (verifiedMaskedId) {
        const match = String(verifiedMaskedId).match(/(\d{4})$/);
        if (match) last4 = match[1];
      }
      const formattedMasked = last4 ? `•••• •••• ${last4}` : "—";

      setFormData?.((prev) => ({
        ...prev,
        ...(finalName
          ? {
              fullName: finalName,
              panName: finalName.toUpperCase(),
            }
          : {}),
        aadhaarNumber: last4 || "",
        aadhaarMasked: formattedMasked,
      }));

      if (finalName) {
        try {
          const stored = JSON.parse(localStorage.getItem("user") || "{}");
          stored.name = finalName;
          localStorage.setItem("user", JSON.stringify(stored));
          window.dispatchEvent(
            new CustomEvent("aquapay:user_updated", { detail: stored })
          );
        } catch (e) {
          console.error("Failed to update user in localStorage", e);
        }
      }

      setAadhaarVerifiedData({
        verifiedName: finalName || "Verified User",
        maskedIdentifier: formattedMasked,
        last4,
      });

      return finalName;
    },
    [setFormData]
  );

  // Polling cleanup
  const stopAadhaarPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Check Aadhaar status from backend
  const handleCheckAadhaarStatus = useCallback(async () => {
    setIsCheckingAadhaarStatus(true);
    setAadhaarErrorMessage("");
    try {
      const sessId = digilockerSessionId;
      const statusRes = await getAadhaarVerificationStatus(sessId || undefined);
      const statusUpper = String(statusRes?.data?.status || "").toUpperCase();

      if (statusUpper === "VERIFIED") {
        stopAadhaarPolling();
        setAadhaarVerified(true);
        setSessionStatus("verified");
        const verifiedName = await syncAadhaarVerifiedName(
          statusRes.data?.verifiedName,
          statusRes.data?.maskedIdentifier
        );
        setCompletedSteps?.((prev) => Array.from(new Set([...prev, 2])));
        toast.success(`Aadhaar e-KYC verified: ${verifiedName || "Verified"}`);
        setCurrentStep?.(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      if (statusUpper === "FAILED") {
        stopAadhaarPolling();
        setSessionStatus("failed");
        setAadhaarErrorMessage(
          "UIDAI authentication failed. Please restart the session."
        );
        toast.error("Aadhaar authentication failed. Please try again.");
        return;
      }

      if (statusUpper === "EXPIRED" || statusRes?.data?.stage === "expired") {
        stopAadhaarPolling();
        setSessionStatus("expired");
        setAadhaarErrorMessage(
          "DigiLocker session has expired. Please restart the verification."
        );
        toast.error("Aadhaar session expired. Please restart.");
        return;
      }

      const kycRes = await getKycStatus();
      if (kycRes?.data?.completedSteps?.includes(2)) {
        stopAadhaarPolling();
        setAadhaarVerified(true);
        setSessionStatus("verified");
        const verifiedName = await syncAadhaarVerifiedName();
        setCompletedSteps?.((prev) => Array.from(new Set([...prev, 2])));
        toast.success(`Aadhaar e-KYC confirmed: ${verifiedName || "Verified"}`);
        setCurrentStep?.(3);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }

      toast.info(
        "Aadhaar authentication is still in progress. Please submit the OTP in the Government DigiLocker window, then check status again."
      );
    } catch (err) {
      const parsed = parseApiError(err);
      toast.error(parsed.message || "Failed to check Aadhaar status.");
    } finally {
      setIsCheckingAadhaarStatus(false);
    }
  }, [
    digilockerSessionId,
    stopAadhaarPolling,
    syncAadhaarVerifiedName,
    setCompletedSteps,
    setCurrentStep,
  ]);

  // Listen for secure DigiLocker postMessage
  useEffect(() => {
    const handlePopupMessage = (e) => {
      const allowed = getExpectedOrigins();
      const originMatch = allowed.some(
        (o) => e.origin && e.origin.toLowerCase() === o.toLowerCase()
      );
      if (!originMatch) return;

      if (
        popupWindowRef.current &&
        e.source &&
        e.source !== popupWindowRef.current
      ) {
        return;
      }

      if (
        e.data?.type === "DIGILOCKER_COMPLETED" ||
        e.data?.action === "kyc_completed"
      ) {
        handleCheckAadhaarStatus();
      }
    };

    window.addEventListener("message", handlePopupMessage);
    return () => window.removeEventListener("message", handlePopupMessage);
  }, [getExpectedOrigins, handleCheckAadhaarStatus]);

  // Clean up polling interval on unmount
  useEffect(() => {
    return () => {
      stopAadhaarPolling();
    };
  }, [stopAadhaarPolling]);

  // Trigger Aadhaar DigiLocker Verification
  const handleTriggerOtp = useCallback(async () => {
    setIsInitiatingDigilocker(true);
    setAadhaarErrorMessage("");
    try {
      toast.info("Connecting to UIDAI verification gateway...");
      const res = await initiateAadhaarVerification(true);
      const authUrl = res?.data?.authorizationUrl;
      const sessId = res?.data?.sessionId;

      if (sessId) setDigilockerSessionId(sessId);
      setOtpSent(true);
      setSessionStatus("pending");
      setAadhaarVerified(false);

      if (authUrl) {
        const popup = window.open(
          authUrl,
          "_blank",
          "width=520,height=680,location=no,status=no"
        );
        popupWindowRef.current = popup;
        toast.success(
          "DigiLocker window opened. Please complete OTP authentication on the official portal.",
          { duration: 6000 }
        );

        if (sessId) {
          stopAadhaarPolling();
          const interval = setInterval(async () => {
            try {
              const statusRes = await getAadhaarVerificationStatus(sessId);
              const statusUpper = String(
                statusRes?.data?.status || ""
              ).toUpperCase();
              if (statusUpper === "VERIFIED") {
                stopAadhaarPolling();
                setAadhaarVerified(true);
                setSessionStatus("verified");
                const verifiedName = await syncAadhaarVerifiedName(
                  statusRes.data?.verifiedName,
                  statusRes.data?.maskedIdentifier
                );
                setCompletedSteps?.((prev) => Array.from(new Set([...prev, 2])));
                toast.success(
                  `Aadhaar e-KYC verified with UIDAI: ${
                    verifiedName || "Verified"
                  }`
                );
              } else if (statusUpper === "FAILED") {
                stopAadhaarPolling();
                setSessionStatus("failed");
              } else if (statusUpper === "EXPIRED") {
                stopAadhaarPolling();
                setSessionStatus("expired");
              }
            } catch {}
          }, 3500);

          pollIntervalRef.current = interval;
          setTimeout(() => {
            stopAadhaarPolling();
          }, 600000);
        }
      } else {
        toast.info(
          "Aadhaar OTP requested. Please enter the OTP received on your mobile."
        );
      }
    } catch (err) {
      const parsed = parseApiError(err);
      const isAlreadyInProgress =
        err?.response?.status === 409 ||
        err?.response?.data?.code === "VERIFICATION_IN_PROGRESS" ||
        parsed?.message?.toLowerCase().includes("already in progress") ||
        parsed?.message?.toLowerCase().includes("session is already");

      if (isAlreadyInProgress) {
        setOtpSent(true);
        setSessionStatus("pending");
        setAadhaarVerified(false);
        toast.info(
          "A verification session is already active. Please authenticate in the government window or check status."
        );

        try {
          const statusRes = await getAadhaarVerificationStatus();
          const sessId = statusRes?.data?.sessionId;
          if (sessId) setDigilockerSessionId(sessId);
          const statusUpper = String(
            statusRes?.data?.status || ""
          ).toUpperCase();
          if (statusUpper === "VERIFIED") {
            setAadhaarVerified(true);
            setSessionStatus("verified");
            const verifiedName = await syncAadhaarVerifiedName(
              statusRes.data?.verifiedName,
              statusRes.data?.maskedIdentifier
            );
            setCompletedSteps?.((prev) => Array.from(new Set([...prev, 2])));
            toast.success(
              `Aadhaar already verified: ${verifiedName || "Verified"}`
            );
          }
        } catch {}
      } else {
        setSessionStatus("failed");
        setAadhaarErrorMessage(
          parsed.message || "Failed to initiate UIDAI session."
        );
        toast.error(
          parsed.message || "Failed to initiate UIDAI Aadhaar session."
        );
      }
    } finally {
      setIsInitiatingDigilocker(false);
    }
  }, [stopAadhaarPolling, syncAadhaarVerifiedName, setCompletedSteps]);

  const handleResetAadhaarSession = useCallback(async () => {
    stopAadhaarPolling();
    setOtpSent(false);
    setDigilockerSessionId(null);
    setAadhaarVerified(false);
    setSessionStatus("idle");
    setAadhaarErrorMessage("");
    try {
      await getAadhaarVerificationStatus();
    } catch {}
    toast.info("Session reset. You can now request a new Aadhaar verification.");
  }, [stopAadhaarPolling]);

  return {
    digilockerSessionId,
    setDigilockerSessionId,
    otpSent,
    setOtpSent,
    sessionStatus,
    setSessionStatus,
    aadhaarErrorMessage,
    setAadhaarErrorMessage,
    isInitiatingDigilocker,
    isCheckingAadhaarStatus,
    aadhaarVerified,
    setAadhaarVerified,
    aadhaarVerifiedData,
    setAadhaarVerifiedData,
    syncAadhaarVerifiedName,
    stopAadhaarPolling,
    handleCheckAadhaarStatus,
    handleTriggerOtp,
    handleResetAadhaarSession,
  };
}