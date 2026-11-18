import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, ChevronLeft, ChevronRight } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { LightAnimatedBackground } from "../../components/common/LightAnimatedBackground";
import { ErrorAlert } from "../../components/common/ErrorAlert";
import { parseApiError } from "../../utils/errorHandler";
import { authenticateWithMe } from "../../api/auth.api";
import { isAdminRole, isNormalUserRole } from "../../constants/roles";

const schema = z.object({
  email: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(1, "Please enter your password"),
  rememberMe: z.boolean().optional(),
});

const SLIDES = [
  "/slide-utility-pay.jpg",
  "/slide-merchant-analytics.jpg",
  "/slide-bulk-batch.jpg",
];

export const LoginPage = () => {
  const [showPw, setShowPw] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });

  // Auto-play slideshow timer (every 3.5 seconds)
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, []);

  // If already logged in as Normal User, redirect straight to /user/dashboard
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      if (token && isNormalUserRole(user)) {
        navigate("/user/dashboard", { replace: true });
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setApiError(null);

      // 1. Shared authentication via POST /api/auth/login + GET /api/auth/me
      const { accessToken, user } = await authenticateWithMe({
        identifier: data.email.trim(),
        password: data.password,
      });

      // 2. Deny Admin role on Normal User Login Page
      if (isAdminRole(user)) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        localStorage.removeItem("adminUser");

        const msg = "Admin accounts cannot sign in through the User Login. Please use the Admin Login.";
        setApiError({
          title: "Access Denied",
          message: msg,
        });
        toast.error(msg);
        return;
      }

      // 3. Verify user belongs to an authorized Normal User role
      if (!isNormalUserRole(user)) {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        localStorage.removeItem("adminUser");

        const msg = "Access Denied: Unrecognized account role. Please contact system support.";
        setApiError({
          title: "Access Denied",
          message: msg,
        });
        toast.error(msg);
        return;
      }

      // 4. Store credentials for authorized normal user
      if (accessToken) {
        localStorage.setItem("accessToken", accessToken);
      }
      if (user) {
        localStorage.setItem("user", JSON.stringify(user));
      }

      toast.success(
        `Welcome back, ${user?.name || "User"}! Signed in successfully.`
      );

      // 5. KYC Status Check for Normal Users
      const isKycDone =
        user?.kyc &&
        ["approved", "completed", "verified", "submitted"].includes(
          String(user.kyc.status || "").toLowerCase()
        );

      if (!isKycDone) {
        toast.info("Please complete your KYC verification to access your dashboard.");
        navigate("/kyc", { replace: true });
      } else {
        navigate("/user/dashboard", { replace: true });
      }
    } catch (err) {
      console.error("User login error:", err);
      const parsed = parseApiError(err);
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate("/forgot-password");
  };

  const handleTerms = () => {
    toast.info("AquaPay Merchant Terms & Conditions");
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-3 sm:p-6 md:p-8 lg:p-12 relative overflow-hidden bg-[#f1f5fa]">
      {/* Animated Light Color Background */}
      <LightAnimatedBackground />

      {/* Main Rounded Card Container - clean light aesthetic with soft elevation */}
      <div className="relative z-10 w-full max-w-[1100px] xl:max-w-[1160px] rounded-[28px] sm:rounded-[36px] lg:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(56,104,176,0.14),0_10px_30px_-10px_rgba(15,23,42,0.06)] border border-slate-200/90 backdrop-blur-md bg-white flex flex-col lg:flex-row overflow-hidden">
        
        {/* Left Column: Form */}
        <div className="w-full lg:w-1/2 bg-white flex flex-col justify-center px-6 py-10 sm:px-12 sm:py-14 md:px-14 lg:py-12">
          <div className="w-full max-w-[360px] mx-auto">
            {/* AquaPay Brand Logo */}
            <div className="mb-6">
              <img
                src="/aquapay-logo.jpeg"
                alt="AquaPay"
                className="h-16 sm:h-20 w-auto object-contain select-none"
              />
            </div>

            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-[26px] font-black italic tracking-wide text-slate-900 uppercase font-['Outfit',sans-serif]">
                WELCOME BACK
              </h1>
              <p className="text-[#64748b] text-[13px] mt-1.5 leading-relaxed font-normal">
                Sign in to your account to manage your transactions, onboarding, and disputes securely.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* API Error Notification Banner */}
              <ErrorAlert error={apiError} onDismiss={() => setApiError(null)} />

              {/* Email Field */}
              <div>
                <label 
                  htmlFor="login-email" 
                  className="block text-[13px] font-medium text-[#4b5563] mb-1.5"
                >
                  Email or Mobile No
                </label>
                <input
                  {...register("email")}
                  id="login-email"
                  type="text"
                  placeholder="Enter your username or email"
                  className={`w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13.5px] font-medium rounded-xl px-4 py-3 outline-none transition-all duration-200 border ${
                    errors.email ? "border-rose-400 bg-rose-50/40" : "border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                  }`}
                />
                {errors.email && (
                  <p className="text-xs text-rose-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Password Field with "Forgot password?" */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label 
                    htmlFor="login-password" 
                    className="text-[13px] font-medium text-[#4b5563]"
                  >
                    Password
                  </label>
                  
                </div>
                <div className="relative flex items-center">
                  <input
                    {...register("password")}
                    id="login-password"
                    type={showPw ? "text" : "password"}
                    placeholder="••••••••"
                    className={`w-full bg-[#f0f0f2] hover:bg-[#eaebee] focus:bg-white text-[#18181b] placeholder-[#a1a1aa] text-[13.5px] font-medium rounded-xl px-4 py-3 pr-11 outline-none transition-all duration-200 border ${
                      errors.password ? "border-rose-400 bg-rose-50/40" : "border-transparent focus:border-slate-300 focus:ring-2 focus:ring-black/5"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-neutral-400 hover:text-neutral-600 transition-colors cursor-pointer"
                    tabIndex={-1}
                    aria-label={showPw ? "Hide password" : "Show password"}
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[12.5px] text-[#3b82f6] hover:text-blue-700 hover:underline font-normal transition-colors cursor-pointer"
                  >
                    Forgot password?
                  </button>
                {errors.password && (
                  <p className="text-xs text-rose-500 mt-1">{errors.password.message}</p>
                )}
              </div>

              {/* Remember Me Checkbox */}
              <div className="flex items-center gap-2.5 pt-1">
                <input
                  {...register("rememberMe")}
                  id="remember-me"
                  type="checkbox"
                  className="w-4 h-4 rounded-[4px] border-neutral-300 text-black accent-black focus:ring-0 cursor-pointer"
                />
                <label 
                  htmlFor="remember-me" 
                  className="text-[13px] text-[#4b5563] cursor-pointer select-none"
                >
                  Remember me
                </label>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                id="login-submit-button"
                disabled={isLoading}
                className="w-full bg-[#18181b] hover:bg-black active:scale-[0.99] text-white font-medium text-sm py-3.5 rounded-xl transition-all duration-200 shadow-sm mt-3 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Signing in...</span>
                  </span>
                ) : (
                  <span>Login</span>
                )}
              </button>

              {/* Terms and Conditions Confirmation */}
              <p className="text-[12px] text-[#64748b] pt-1 leading-relaxed">
                By proceeding, you confirm that you've read, understood, and agree to our{" "}
                <button
                  type="button"
                  onClick={handleTerms}
                  className="text-blue-600 hover:underline font-medium cursor-pointer"
                >
                  Terms & Conditions
                </button>.
              </p>

              {/* Link to Admin Login */}
              <div className="pt-2 text-center border-t border-slate-100">
                <Link
                  to="/login/admin"
                  className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
                >
                  System Administrator? <span className="text-blue-600 font-semibold hover:underline">Admin Login</span>
                </Link>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Clean Visual Image Slideshow */}
        <div className="w-full lg:w-1/2 relative min-h-[460px] sm:min-h-[520px] lg:min-h-[600px] overflow-hidden bg-gradient-to-br from-[#f8fbfe] via-white to-[#edf5fc] flex items-center justify-center p-6 sm:p-10 group select-none">
          {/* Slide Visual Images with Crossfade and Full Visibility */}
          {SLIDES.map((imgSrc, idx) => (
            <div
              key={imgSrc}
              className={`absolute inset-0 flex items-center justify-center p-6 sm:p-10 transition-all duration-700 ease-in-out ${
                idx === currentSlide
                  ? "opacity-100 scale-100 z-10"
                  : "opacity-0 scale-95 pointer-events-none z-0"
              }`}
            >
              <img
                src={imgSrc}
                alt={`Slideshow illustration ${idx + 1}`}
                className="max-w-full max-h-[440px] sm:max-h-[480px] lg:max-h-[520px] w-auto h-auto object-contain rounded-2xl drop-shadow-[0_16px_36px_rgba(56,104,176,0.14)] select-none"
              />
            </div>
          ))}

          {/* Left / Right Arrow Navigation Buttons */}
          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev - 1 + SLIDES.length) % SLIDES.length)}
            className="absolute left-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Previous slide"
          >
            <ChevronLeft size={18} />
          </button>

          <button
            type="button"
            onClick={() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length)}
            className="absolute right-4 z-20 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-md flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
            title="Next slide"
          >
            <ChevronRight size={18} />
          </button>

          {/* Minimal Navigation Progress Indicators / Dots */}
          <div className="absolute bottom-6 z-20 flex items-center gap-2 bg-white/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-slate-200/60 shadow-xs">
            {SLIDES.map((imgSrc, idx) => (
              <button
                key={imgSrc}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                  idx === currentSlide
                    ? "w-7 bg-blue-600 shadow-xs"
                    : "w-2 bg-slate-300 hover:bg-slate-400"
                }`}
                title={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
