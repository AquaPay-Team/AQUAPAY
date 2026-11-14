import React, { useRef } from "react";
import { ShieldCheck, RefreshCw, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";

/**
 * Step 1 OTP Verification Card
 *
 * Shown AFTER the user saves Basic Details.
 * Calls real backend: POST /api/kyc/basic-details/request-otp
 *                     POST /api/kyc/basic-details/verify-otp
 *
 * In development mode the OTP is printed to the backend server console,
 * NOT sent via SMS (no SMS carrier configured).
 */
export function Step1OtpVerification({
  otpValue,          
  onOtpChange,       
  otpTimer,         
  onRequestOtp,      
  isRequesting,     
  onVerify,         
  isVerifying,      
  error,            
  onBack,           
}) {
  const inputRefs = useRef([]);

  const handleDigitChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, "");
    // Support paste of full 6-digit OTP
    if (raw.length > 1) {
      const digits = raw.slice(0, 6).split("");
      const newArr = [...otpValue];
      digits.forEach((d, i) => {
        if (index + i < 6) newArr[index + i] = d;
      });
      onOtpChange(newArr);
      const nextFocus = Math.min(index + digits.length, 5);
      inputRefs.current[nextFocus]?.focus();
      return;
    }
    const newArr = [...otpValue];
    newArr[index] = raw;
    onOtpChange(newArr);
    if (raw && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otpValue[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const canResend = !isRequesting && otpTimer === 0;
  const otpFull = otpValue.join("").length === 6;

  return (
    <div className="space-y-6 max-w-md mx-auto text-center">
      
      <div className="w-14 h-14 bg-blue-50 border border-blue-100 rounded-2xl mx-auto flex items-center justify-center">
        <ShieldCheck className="w-7 h-7 text-blue-600" />
      </div>

      <div className="space-y-1">
        <h3 className="text-base font-semibold text-slate-900">Verify Your Identity</h3>
        <p className="text-xs text-slate-500 leading-relaxed">
          An OTP has been dispatched to verify your contact details.
          <br />
        </p>
      </div>

      
      <div className="flex justify-center gap-2.5 pt-2">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={otpValue[i] || ""}
            onChange={(e) => handleDigitChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className={`w-12 h-12 text-center text-lg font-bold bg-white border rounded-xl text-slate-900 focus:outline-none shadow-xs transition ${
              error
                ? "border-rose-400 bg-rose-50/30 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            }`}
          />
        ))}
      </div>

     
      {error && (
        <p className="text-xs text-rose-500 flex items-center justify-center gap-1 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </p>
      )}

      
      <div className="text-xs text-slate-500">
        {otpTimer > 0 ? (
          <span>
            Resend OTP in{" "}
            <span className="text-blue-700 font-mono font-bold">
              00:{otpTimer < 10 ? `0${otpTimer}` : otpTimer}
            </span>
          </span>
        ) : (
          <button
            type="button"
            onClick={onRequestOtp}
            disabled={isRequesting}
            className="text-blue-600 hover:text-blue-700 font-medium underline underline-offset-2 disabled:opacity-50 cursor-pointer"
          >
            {isRequesting ? "Sending OTP…" : "Resend OTP"}
          </button>
        )}
      </div>

     
      <button
        type="button"
        onClick={onVerify}
        disabled={!otpFull || isVerifying}
        className="w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm py-3 rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Verifying…</span>
          </>
        ) : (
          <>
            <ShieldCheck className="w-4 h-4" />
            <span>Verify &amp; Continue to Aadhaar</span>
          </>
        )}
      </button>

      
      <button
        type="button"
        onClick={onBack}
        disabled={isVerifying}
        className="text-xs text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1 mx-auto transition cursor-pointer"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        Back to Basic Details
      </button>
    </div>
  );
}

export default Step1OtpVerification;
