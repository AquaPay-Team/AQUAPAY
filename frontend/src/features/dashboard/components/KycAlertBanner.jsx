import React from "react";
import { Link } from "react-router-dom";
import { AlertCircle, Clock } from "lucide-react";

export function KycAlertBanner({ isKycPending, isKycUnderReview }) {
  if (isKycPending) {
    return (
      <div className="bg-white border border-amber-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertCircle className="w-5 h-5 text-black" strokeWidth={2} />
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm block">KYC Verification Incomplete</span>
            <span className="text-slate-500 text-xs">
              Complete your identity and business documentation to activate live counter collection and settlement services.
            </span>
          </div>
        </div>
        <Link
          to="/user/kyc"
          className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
        >
          Complete KYC
        </Link>
      </div>
    );
  }

  if (isKycUnderReview) {
    return (
      <div className="bg-white border border-blue-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-sm transition-shadow">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-black" strokeWidth={2} />
          </div>
          <div>
            <span className="font-bold text-slate-800 text-sm block">KYC Under Compliance Review</span>
            <span className="text-slate-500 text-xs">
              Your onboarding documentation has been submitted and is currently being verified. Payout services will activate once approved.
            </span>
          </div>
        </div>
        <Link
          to="/user/kyc"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center"
        >
          View Application
        </Link>
      </div>
    );
  }

  return null;
}

export default KycAlertBanner;
