import React from "react";
import { ShieldCheck, RefreshCw, Eye, EyeOff, Loader2 } from "lucide-react";
import { ErrorAlert } from "@/components/common/ErrorAlert";

export function ForgotPasswordStep2({
  identifier,
  otp,
  setOtp,
  resetToken,
  setResetToken,
  newPassword,
  setNewPassword,
  confirmPassword,
  setConfirmPassword,
  showNewPw,
  setShowNewPw,
  showConfirmPw,
  setShowConfirmPw,
  isLoading,
  apiError,
  setApiError,
  resendCooldown,
  handleResend,
  handleResetPassword,
  onBackToStep1,
}) {
  return (
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
            onClick={onBackToStep1}
            className="text-xs text-slate-500 hover:text-slate-800 font-medium hover:underline cursor-pointer"
          >
            ← Change email or mobile number
          </button>
        </div>
      </form>
    </div>
  );
}

export default ForgotPasswordStep2;
