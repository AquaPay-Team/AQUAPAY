import { useAuth } from "../../features/auth/useAuth";
import { isKycComplete } from "../../features/kyc/model/kycStatus";
import { ROUTES } from "../../routes/paths";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { LightAnimatedBackground } from "../../components/common/LightAnimatedBackground";
import { ErrorAlert } from "../../components/common/ErrorAlert";
import { parseApiError } from "../../utils/errorHandler";
import { authenticateWithMe } from "../../api/auth.api";
import { isAdminRole, isNormalUserRole } from "../../constants/roles";
import { AuthSlideshow } from "@/features/auth";

const schema = z.object({
  email: z.string().min(1, "Please enter your email or username"),
  password: z.string().min(1, "Please enter your password"),
  rememberMe: z.boolean().optional(),
});

export const LoginPage = () => {
  const navigate = useNavigate();
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  // const navigate = useNavigate();
    const { login } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: true,
    },
  });
  // Redirect if already authenticated
  const { isAuthenticated, isAdmin, user, isLoading: authLoading } = useAuth();
  useEffect(() => {
    if (authLoading || !isAuthenticated || !user) return;
    if (isAdmin) {
      navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
    } else {
      const kycDone = isKycComplete(user?.kyc?.status);
      navigate(kycDone ? ROUTES.USER_DASHBOARD : ROUTES.KYC, { replace: true });
    }
  }, [authLoading, isAuthenticated, isAdmin, user, navigate]);

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setApiError(null);

      // Shared authentication via POST /api/auth/login + GET /api/auth/me
      const { accessToken, user: authUser } = await authenticateWithMe({
        identifier: data.email.trim(),
        password: data.password,
      });

      if (!isAdminRole(authUser) && !isNormalUserRole(authUser)) {
        const msg = "Access Denied: Unrecognized account role. Please contact system support.";
        setApiError({
          title: "Access Denied",
          message: msg,
        });
        toast.error(msg);
        return;
      }

      // Hand over session management to AuthContext
      login({ token: accessToken, user: authUser });

      toast.success(
        `Welcome back, ${authUser?.name || "User"}! Signed in successfully.`
      );

      if (isAdminRole(authUser)) {
        navigate(ROUTES.ADMIN_DASHBOARD, { replace: true });
        return;
      }

      // Unified KYC check
      if (!isKycComplete(authUser?.kyc?.status)) {
        toast.info("Please complete your KYC verification to access your dashboard.");
        navigate(ROUTES.KYC, { replace: true });
      } else {
        navigate(ROUTES.USER_DASHBOARD, { replace: true });
      }
    } catch (err) {
      const parsed = parseApiError(err);
      setApiError(parsed);
      toast.error(parsed.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigate(ROUTES.FORGOT_PASSWORD);
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
                    // onClick={handleForgotPassword}
                    onClick={() => navigate("/forgot-password")}
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

            </form>
          </div>
        </div>

        {/* Right Column: Clean Visual Image Slideshow */}
        <AuthSlideshow />

      </div>
    </div>
  );
};

export default LoginPage;
