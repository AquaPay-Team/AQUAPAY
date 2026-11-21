import React from "react";
import { CheckCircle2, Lock } from "lucide-react";

export function ForgotPasswordSuccess({ onProceedToLogin }) {
  return (
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
        onClick={onProceedToLogin}
        className="w-full bg-black hover:bg-neutral-800 active:scale-[0.99] text-white font-semibold text-[14px] rounded-xl py-3.5 transition-all duration-150 shadow-md hover:shadow-lg flex items-center justify-center gap-2 cursor-pointer"
      >
        <Lock size={16} />
        Proceed to Login
      </button>
    </div>
  );
}

export default ForgotPasswordSuccess;
