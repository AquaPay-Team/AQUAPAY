import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { parseApiError } from "../../utils/errorHandler";
import { adminLogin, isAdminUser } from "../../features/admin/services/adminApi";

const schema = z.object({
  identifier: z
    .string()
    .min(1, "Please enter your administrator email or mobile number"),
  password: z
    .string()
    .min(1, "Please enter your password"),
  rememberMe: z.boolean().optional(),
});

export default function AdminLoginPage() {
  const [showPw, setShowPw] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      identifier: "",
      password: "",
      rememberMe: true,
    },
  });

  // If already logged in as Admin, redirect straight to /admin
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    try {
      const user = JSON.parse(
        localStorage.getItem("adminUser") || localStorage.getItem("user") || "null"
      );
      if (token && isAdminUser(user)) {
        navigate("/admin/dashboard", { replace: true });
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const onSubmit = async (data) => {
    try {
      setIsLoading(true);
      setApiError(null);

      const response = await adminLogin({
        identifier: data.identifier.trim(),
        password: data.password,
      });

      const user = response?.data?.user;
      toast.success(
        `Welcome back, ${user?.name || "Administrator"}! Signed in successfully.`
      );

      const redirectPath = location.state?.from?.pathname || "/admin/dashboard";
      navigate(redirectPath, { replace: true });
    } catch (err) {
      console.error("Admin login error:", err);
      const parsed = parseApiError(err);
      // Ensure specific unauthorized message is highlighted
      if (err.message && err.message.includes("not authorized to access the Admin Panel")) {
        setApiError({
          title: "Access Denied",
          message: err.message,
        });
        toast.error(err.message);
      } else {
        setApiError(parsed);
        toast.error(parsed.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-[#f8fafc] text-slate-800 font-sans">
      {/* Main White Clean Card */}
      <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
        {/* Brand Logo & Header */}
        <div className="text-center">
          <img
            src="/aquapay-logo.jpeg"
            alt="AquaPay Logo"
            className="h-25 w-auto object-contain mx-auto mb-3 select-none"
          />

          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            Administrator Sign In
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Access the central system
          </p>
        </div>

        {/* API Error Notification */}
        {apiError && (
          <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{apiError.title || "Login Failed"}</p>
              <p className="text-rose-600/90 mt-0.5">{apiError.message}</p>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="mt-5 space-y-4">
          {/* Email / Mobile Field */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Email or Mobile Number
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type="text"
                autoComplete="username"
                placeholder="Enter your admin email or mobile"
                {...register("identifier")}
                className={`w-full pl-9 pr-3 py-2 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                  errors.identifier
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:border-blue-500 focus:bg-white"
                }`}
              />
            </div>
            {errors.identifier && (
              <p className="text-[11px] text-rose-500 font-medium">
                {errors.identifier.message}
              </p>
            )}
          </div>

          {/* Password Field */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your password"
                {...register("password")}
                className={`w-full pl-9 pr-9 py-2 bg-slate-50 border rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-colors ${
                  errors.password
                    ? "border-rose-400 bg-rose-50/20"
                    : "border-slate-200 focus:border-blue-500 focus:bg-white"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPw((prev) => !prev)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                tabIndex={-1}
              >
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[11px] text-rose-500 font-medium">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Remember Me */}
          <div className="flex items-center justify-between text-xs pt-0.5">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600">
              <input
                type="checkbox"
                {...register("rememberMe")}
                className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span>Remember me</span>
            </label>

            <span className="text-[11px] text-slate-400">
              Session Encrypted
            </span>
          </div>

          {/* Sign In Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-lg font-semibold text-xs bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer shadow-xs"
          >
            {isLoading ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Verifying...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>

        {/* Switch to User Login */}
        <div className="mt-4 text-center border-t border-slate-100 pt-3">
          <Link
            to="/login/user"
            className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
          >
            Looking for User Portal? <span className="text-blue-600 font-semibold hover:underline">User Login</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
