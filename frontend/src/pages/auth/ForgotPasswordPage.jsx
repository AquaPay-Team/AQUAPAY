import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import {
  Eye,
  EyeOff,
  ArrowLeft,
  Mail,
  KeyRound,
  Lock,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { LightAnimatedBackground } from "../../components/common/LightAnimatedBackground";
import { ErrorAlert } from "../../components/common/ErrorAlert";
import { parseApiError } from "../../utils/errorHandler";
import { forgotPassword, resetPassword } from "../../api/auth.api";

const SLIDES = [
  "/slide-utility-pay.jpg",
  "/slide-merchant-analytics.jpg",
  "/slide-bulk-batch.jpg",
];

export const ForgotPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // If token is passed via query param (e.g. from email link ?token=XYZ)
  const tokenFromUrl = searchParams.get("token") || "";

  // Step 1: Request OTP/Token, Step 2: Enter OTP & New Password, Step 3: Completed
  const [step, setStep] = useState(tokenFromUrl ? 2 : 1);
  const [currentSlide, setCurrentSlide] = useState(0);

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

  // Auto slideshow
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

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
      console.error("Forgot password error:", err);
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
      console.error("Resend OTP error:", err);
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
      console.error("Reset password error:", err);
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
                onClick={() => navigate("/login/user")}
              />
              <button
                type="button"
                onClick={() => navigate("/login/user")}
                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            </div>

            {/* STEP 1: Enter Email / Mobile */}
            {step === 1 && (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
                    <KeyRound size={13} />
                    Account Recovery
                  </div>
                  <h1 className="text-2xl sm:text-[26px] font-black italic tracking-wide text-slate-900 uppercase font-['Outfit',sans-serif]">
                    FORGOT PASSWORD
                  </h1>
                  <p className="text-[#64748b] text-[13px] mt-1.5 leading-relaxed font-normal">
                    Enter your registered email address or mobile number. We'll send you a 6-digit OTP to reset your password.
                  </p>
                </div>

                <form onSubmit={handleRequestOtp} className="space-y-4">
                  {/* API Error Notification */}
                  <ErrorAlert error={apiError} onDismiss={() => setApiError(null)} />

                  <div>
                    <label
                      htmlFor="forgot-identifier"
                      className="block text-[13px] font-medium text-[#4b5563] mb-1.5"
                    >
                      Registered Email or Mobile Number
                    </label>
                    <div className="relative flex items-center">
                      <div className="absolute left-3.5 text-slate-400 pointer-events-none">
                        <Mail size={16} />
                      </div>
                      <input
                        id="forgot-identifier"
                        type="text"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="e.g. rahul@example.com or +919876543210"
                        className="w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13.5px] font-medium rounded-xl pl-10 pr-4 py-3 outline-none transition-all duration-200 border border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                        disabled={isLoading}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-[14px] rounded-xl py-3.5 transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={17} />
                        Sending Code...
                      </>
                    ) : (
                      "Send Recovery OTP"
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <p className="text-xs text-slate-500">
                      Remember your password?{" "}
                      <Link
                        to="/login/user"
                        className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
                      >
                        Sign in
                      </Link>
                    </p>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 2: Enter OTP & Set New Password */}
            {step === 2 && (
              <div>
                <div className="mb-6">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3">
                    <ShieldCheck size={13} />
                    Identity Verification
                  </div>
                  <h1 className="text-2xl sm:text-[26px] font-black italic tracking-wide text-slate-900 uppercase font-['Outfit',sans-serif]">
                    SET NEW PASSWORD
                  </h1>
                  <p className="text-[#64748b] text-[13px] mt-1.5 leading-relaxed font-normal">
                    Enter the 6-digit OTP sent to{" "}
                    <span className="font-semibold text-slate-800">
                      {identifier || "your registered contact"}
                    </span>
                    .
                  </p>
                </div>

                <form onSubmit={handleResetPassword} className="space-y-4">
                  {/* API Error Notification */}
                  <ErrorAlert error={apiError} onDismiss={() => setApiError(null)} />

                  {/* OTP Field */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label
                        htmlFor="reset-otp"
                        className="text-[13px] font-medium text-[#4b5563]"
                      >
                        6-Digit Verification OTP
                      </label>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendCooldown > 0 || isLoading}
                        className="text-xs font-medium text-blue-600 hover:text-blue-700 disabled:text-slate-400 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                      >
                        <RefreshCw
                          size={12}
                          className={isLoading ? "animate-spin" : ""}
                        />
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend OTP"}
                      </button>
                    </div>
                    <input
                      id="reset-otp"
                      type="text"
                      maxLength={6}
                      value={otp}
                      onChange={(e) =>
                        setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                      }
                      placeholder="• • • • • •"
                      className="w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] tracking-widest text-center placeholder-[#a1a1aa] text-lg font-bold rounded-xl px-4 py-2.5 outline-none transition-all duration-200 border border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                      disabled={isLoading}
                      required
                      autoFocus
                    />
                  </div>

                  {/* Reset Token fallback (if not received automatically) */}
                  {!resetToken && (
                    <div>
                      <label
                        htmlFor="reset-token"
                        className="block text-[13px] font-medium text-[#4b5563] mb-1.5"
                      >
                        Reset Token (from email/SMS)
                      </label>
                      <input
                        id="reset-token"
                        type="text"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        placeholder="Paste reset token here"
                        className="w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13px] font-mono rounded-xl px-4 py-2.5 outline-none transition-all duration-200 border border-transparent focus:border-slate-300"
                        required
                      />
                    </div>
                  )}

                  {/* New Password */}
                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-[13px] font-medium text-[#4b5563] mb-1.5"
                    >
                      New Password (Min 8 chars)
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="new-password"
                        type={showNewPw ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new strong password"
                        className="w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13.5px] font-medium rounded-xl px-4 py-3 pr-11 outline-none transition-all duration-200 border border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showNewPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-[13px] font-medium text-[#4b5563] mb-1.5"
                    >
                      Confirm New Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="confirm-password"
                        type={showConfirmPw ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Re-type new password"
                        className="w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13.5px] font-medium rounded-xl px-4 py-3 pr-11 outline-none transition-all duration-200 border border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                        disabled={isLoading}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw((v) => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                        tabIndex={-1}
                      >
                        {showConfirmPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-[14px] rounded-xl py-3.5 transition-all duration-150 shadow-md hover:shadow-lg disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-2"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={17} />
                        Updating Password...
                      </>
                    ) : (
                      "Reset & Save Password"
                    )}
                  </button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setStep(1)}
                      className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline cursor-pointer"
                    >
                      ← Change email or mobile number
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* STEP 3: Success Screen */}
            {step === 3 && (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-inner">
                  <CheckCircle2 size={36} />
                </div>
                <h1 className="text-2xl sm:text-[26px] font-black italic tracking-wide text-slate-900 uppercase font-['Outfit',sans-serif]">
                  PASSWORD CHANGED
                </h1>
                <p className="text-[#64748b] text-[13.5px] mt-2 mb-8 leading-relaxed">
                  Your password has been successfully reset. You can now use your new credentials to sign in to your AquaPay account.
                </p>

                <button
                  type="button"
                  onClick={() => navigate("/login/user")}
                  className="w-full bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-[14px] rounded-xl py-3.5 transition-all duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Lock size={16} />
                  Proceed to Login
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Promotional Slideshow matching Login */}
        <div className="hidden lg:block lg:w-1/2 relative bg-slate-950 overflow-hidden min-h-[580px]">
          {SLIDES.map((slide, idx) => (
            <div
              key={slide}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentSlide ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
              }`}
            >
              <img
                src={slide}
                alt="AquaPay Platform"
                className="w-full h-full object-cover select-none transition-transform duration-1000"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/20" />
            </div>
          ))}

          {/* Slide Caption Overlay */}
          <div className="absolute bottom-8 left-8 right-8 text-white z-20">
            <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md text-[11px] font-semibold tracking-wider uppercase rounded-full mb-3 border border-white/20">
              Enterprise Banking & Settlement
            </span>
            <h2 className="text-2xl font-bold font-['Outfit',sans-serif] leading-tight drop-shadow-md">
              Secure Next-Gen Merchant Banking
            </h2>
            <p className="text-white/80 text-xs mt-2 max-w-md font-light leading-relaxed">
              Instant settlements, enterprise KYC verification, and seamless payout rails engineered for scale and ironclad compliance.
            </p>

            {/* Slide dots */}
            <div className="flex items-center gap-2 mt-5">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                    i === currentSlide
                      ? "w-7 bg-white shadow-sm"
                      : "w-2 bg-white/40 hover:bg-white/70"
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            type="button"
            onClick={() =>
              setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)
            }
            className="absolute left-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white/90 flex items-center justify-center transition-all cursor-pointer border border-white/10"
            aria-label="Previous slide"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() =>
              setCurrentSlide((prev) => (prev + 1) % SLIDES.length)
            }
            className="absolute right-4 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/40 hover:bg-black/70 backdrop-blur-sm text-white/90 flex items-center justify-center transition-all cursor-pointer border border-white/10"
            aria-label="Next slide"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;

