import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { parseApiError } from "@/utils/errorHandler";
import { requestBasicDetailsOtp, verifyBasicDetailsOtp } from "@/api/kyc.api";

export function useStep1Otp({ setCompletedSteps, setCurrentStep }) {
  const [step1OtpPhase, setStep1OtpPhase] = useState(false);
  const [step1OtpValue, setStep1OtpValue] = useState(["", "", "", "", "", ""]);
  const [step1OtpTimer, setStep1OtpTimer] = useState(0);
  const [isRequestingStep1Otp, setIsRequestingStep1Otp] = useState(false);
  const [isVerifyingStep1Otp, setIsVerifyingStep1Otp] = useState(false);
  const [step1OtpError, setStep1OtpError] = useState("");

  // OTP countdown timer
  useEffect(() => {
    let interval = null;
    if (step1OtpPhase && step1OtpTimer > 0) {
      interval = setInterval(() => setStep1OtpTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [step1OtpPhase, step1OtpTimer]);

  const handleRequestStep1Otp = useCallback(async () => {
    setIsRequestingStep1Otp(true);
    setStep1OtpError("");
    try {
      await requestBasicDetailsOtp();
      setStep1OtpTimer(60);
      setStep1OtpValue(["", "", "", "", "", ""]);
      toast.success(
        "OTP sent! In development mode the OTP is printed in the backend server console."
      );
    } catch (err) {
      const parsed = parseApiError(err);
      if (parsed.type === "RATE_LIMIT") {
        setStep1OtpError("Please wait before requesting another OTP.");
        toast.error("Please wait before requesting another OTP.");
      } else {
        toast.error(parsed.message || "Failed to request OTP. Please try again.");
      }
    } finally {
      setIsRequestingStep1Otp(false);
    }
  }, []);

  const handleVerifyStep1Otp = useCallback(async () => {
    const otp = step1OtpValue.join("");
    if (otp.length !== 6) {
      setStep1OtpError("Please enter all 6 digits of the OTP.");
      return;
    }
    setStep1OtpError("");
    setIsVerifyingStep1Otp(true);
    try {
      await verifyBasicDetailsOtp(otp);
      setCompletedSteps?.((prev) => Array.from(new Set([...prev, 1])));
      setStep1OtpPhase(false);
      toast.success("Step 1 verified successfully! Proceeding to Aadhaar verification.");
      setCurrentStep?.(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      const parsed = parseApiError(err);
      setStep1OtpError(parsed.message || "Invalid or expired OTP. Please try again.");
      toast.error(parsed.message || "Invalid or expired OTP. Please try again.");
    } finally {
      setIsVerifyingStep1Otp(false);
    }
  }, [step1OtpValue, setCompletedSteps, setCurrentStep]);

  return {
    step1OtpPhase,
    setStep1OtpPhase,
    step1OtpValue,
    setStep1OtpValue,
    step1OtpTimer,
    setStep1OtpTimer,
    isRequestingStep1Otp,
    isVerifyingStep1Otp,
    step1OtpError,
    setStep1OtpError,
    handleRequestStep1Otp,
    handleVerifyStep1Otp,
  };
}