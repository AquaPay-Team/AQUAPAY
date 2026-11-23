import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { LightAnimatedBackground } from "../../components/common/LightAnimatedBackground";
import { parseApiError } from "../../utils/errorHandler";
import { forgotPassword, resetPassword } from "../../api/auth.api";
import {
  AuthSlideshow,
  ForgotPasswordStep1,
  ForgotPasswordStep2,
  ForgotPasswordSuccess,
} from "@/features/auth";

export const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // If token is passed via query param (e.g. from email link ?token=XYZ)
  const tokenFromUrl = searchParams.get("token") || "";

  // Step 1: Request OTP/Token, Step 2: Enter OTP & New Password, Step 3: Completed
  const [step, setStep] = useState(tokenFromUrl ? 2 : 1);

  // Form states
  const [identifier, setIdentifier] = useState("");
  const [resetToken, setResetToken] = useState(tokenFromUrl);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // UI states
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Handle Step 1: Request OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const cleanId = identifier.trim();

    if (!cleanId) {
      toast.error("Please enter your registered email or mobile number.");
      return;
    }

    try {
      setIsLoading(true);
      setApiError(null);
      const res = await forgotPassword(cleanId);

      if (res?.data?.resetToken) {
        setResetToken(res.data.resetToken);
      }

      toast.success(
        res?.message || "Recovery code sent to your registered contact."
      );
      setResendCooldown(45);
      setStep(2);
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0 || !identifier.trim()) return;

    try {
      setIsLoading(true);
      setApiError(null);
      const res = await forgotPassword(identifier.trim());

      if (res?.data?.resetToken) {
        setResetToken(res.data.resetToken);
      }

      toast.success("A fresh verification OTP has been sent.");
      setResendCooldown(45);
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Step 2: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setApiError(null);

    const cleanOtp = otp.trim();
    const cleanToken = resetToken.trim();

    if (!cleanToken) {
      const err = {
        type: "VALIDATION_ERROR",
        title: "Missing Security Token",
        message:
          "Reset security token is missing. Please re-enter your email to get a new code.",
      };
      setApiError(err);
      toast.error(err.message);
      setStep(1);
      return;
    }

    if (!cleanOtp || !/^\d{6}$/.test(cleanOtp)) {
      const err = {
        type: "VALIDATION_ERROR",
        title: "Invalid OTP",
        message: "Please enter a valid 6-digit verification OTP.",
      };
      setApiError(err);
      toast.error(err.message);
      return;
    }

    if (!newPassword || newPassword.length < 8) {
      const err = {
        type: "VALIDATION_ERROR",
        title: "Password Too Short",
        message: "Password must be at least 8 characters long.",
      };
      setApiError(err);
      toast.error(err.message);
      return;
    }

    if (newPassword !== confirmPassword) {
      const err = {
        type: "VALIDATION_ERROR",
        title: "Password Mismatch",
        message: "Passwords do not match. Please re-verify.",
      };
      setApiError(err);
      toast.error(err.message);
      return;
    }

    try {
      setIsLoading(true);
      const res = await resetPassword({
        token: cleanToken,
        otp: cleanOtp,
        password: newPassword,
      });

      toast.success(res?.message || "Password updated successfully!");
      setStep(3);
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 md:p-8 lg:p-12 relative overflow-hidden bg-[#f1f5fa]">
      {/* Light animated backdrop */}
      <LightAnimatedBackground />

      {/* Main Container Card */}
      <div className="relative z-10 w-full max-w-[1100px] xl:max-w-[1160px] rounded-[28px] sm:rounded-[36px] lg:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(56,104,176,0.14),0_10px_30px_-10px_rgba(15,23,42,0.06)] border border-slate-200/90 backdrop-blur-md bg-white flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Column: Form Flow */}
        <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 md:px-14 lg:py-12">
          <div className="w-full max-w-[380px] mx-auto">
            {/* Logo */}
            <div className="mb-6 flex items-center justify-between">
              <img
                src="/aquapay-logo.jpeg"
                alt="AquaPay"
                className="h-14 sm:h-16 w-auto object-contain select-none cursor-pointer"
                onClick={() => navigate("/login")}
              />
              <button
                type="button"
                onClick={() => navigate("/login")}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            </div>

            {/* STEP 1: Enter Email / Mobile */}
            {step === 1 && (
              <ForgotPasswordStep1
                identifier={identifier}
                setIdentifier={setIdentifier}
                handleRequestOtp={handleRequestOtp}
                isLoading={isLoading}
                apiError={apiError}
                setApiError={setApiError}
              />
            )}

            {/* STEP 2: Enter OTP & Set New Password */}
            {step === 2 && (
              <ForgotPasswordStep2
                identifier={identifier}
                otp={otp}
                setOtp={setOtp}
                resetToken={resetToken}
                setResetToken={setResetToken}
                newPassword={newPassword}
                setNewPassword={setNewPassword}
                confirmPassword={confirmPassword}
                setConfirmPassword={setConfirmPassword}
                showNewPw={showNewPw}
                setShowNewPw={setShowNewPw}
                showConfirmPw={showConfirmPw}
                setShowConfirmPw={setShowConfirmPw}
                isLoading={isLoading}
                apiError={apiError}
                setApiError={setApiError}
                resendCooldown={resendCooldown}
                handleResend={handleResend}
                handleResetPassword={handleResetPassword}
                onBackToStep1={() => setStep(1)}
              />
            )}

            {/* STEP 3: Success Screen */}
            {step === 3 && (
              <ForgotPasswordSuccess
                onProceedToLogin={() => navigate("/login")}
              />
            )}
          </div>
        </div>

        {/* Right Column: Clean Visual Image Slideshow */}
        <AuthSlideshow />
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
