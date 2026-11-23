import React from "react";
import { Link } from "react-router-dom";
import { KeyRound, Mail, Loader2 } from "lucide-react";
import { ErrorAlert } from "@/components/common/ErrorAlert";

export function ForgotPasswordStep1({
  identifier,
  setIdentifier,
  handleRequestOtp,
  isLoading,
  apiError,
  setApiError,
}) {
  return (
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
              to="/login"
              className="text-blue-600 hover:text-blue-700 font-semibold hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}

export default ForgotPasswordStep1;
