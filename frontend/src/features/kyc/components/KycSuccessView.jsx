import React from "react";
import { CheckCircle2, Clock, ShieldCheck, ArrowRight } from "lucide-react";

export function KycSuccessView({ referenceId, onProceedDashboard }) {
  const submissionTime = new Date().toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm text-center">
        {/* Verification Icon */}
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto mb-5 shadow-xs">
          <CheckCircle2 className="w-7 h-7" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 tracking-tight">
          KYC Application Submitted
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed max-w-sm mx-auto">
          Your merchant onboarding details and documentation have been received and are currently under compliance review.
        </p>

        {/* Reference Details Box */}
        <div className="my-6 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-left space-y-2.5">
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Application Reference ID:</span>
            <span className="font-mono font-bold text-slate-900">{referenceId}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Submission Timestamp:</span>
            <span className="text-slate-800 font-medium">{submissionTime}</span>
          </div>
          <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500">Underwriting SLA:</span>
            <span className="text-blue-700 font-semibold flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" /> Within 24-48 Hours
            </span>
          </div>
        </div>

        {/* Notice */}
        <p className="text-xs text-slate-400 mb-6 leading-normal">
          You will receive an SMS and email notification once your verification is completed and settlement services are activated.
        </p>

        {/* Primary Action Button */}
        <button
          type="button"
          onClick={onProceedDashboard}
          className="w-full bg-slate-900 hover:bg-black active:scale-[0.99] text-white font-medium text-sm py-3 rounded-xl transition shadow-xs flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>Go to Merchant Dashboard</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default KycSuccessView;
