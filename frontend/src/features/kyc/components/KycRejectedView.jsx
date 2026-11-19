import React from "react";
import {
  AlertCircle,
  ArrowRight,
  Camera,
  CheckCircle2,
  FileSignature,
  Loader2,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import KycHeader from "./KycHeader";

/**
 * Merchant-only rejection screen. Backend status is authoritative: no local
 * "restart" until POST /kyc/media/restart confirms the transition to pending.
 */
export function KycRejectedView({
  rejectionReason,
  completedSteps = [],
  isRestarting,
  onRestart,
  onRefresh,
  onLogout,
}) {
  const previousStepsVerified = [1, 2, 3, 4].every((step) => completedSteps.includes(step));

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans">
      <KycHeader onLogout={onLogout} />
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-12 space-y-6">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex-1 space-y-2">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold tracking-wide uppercase">
                  Action required
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  Your KYC needs corrections
                </h1>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Your previous KYC submission was rejected during review. You can restart from the media upload step rather than submitting your identity and bank details again.
                </p>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-8 py-6 space-y-5">
            <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 mb-2">Reviewer's reason</p>
              <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-wrap break-words">
                {rejectionReason?.trim() || "A detailed reason is not available right now. Please contact AquaPay support if you need clarification."}
              </p>
            </div>

            <div className="rounded-xl bg-emerald-50/60 border border-emerald-200 p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-emerald-900">Your earlier verification is preserved</p>
                <p className="text-xs text-emerald-900/85 leading-relaxed">
                  Steps 1–4 (basic details, Aadhaar, PAN and bank details) {previousStepsVerified
                    ? "are already complete and won't need to be repeated."
                    : "must be complete before the server can restart this application."}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-900">What you'll do next</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Camera, step: "Step 5", title: "Upload fresh media", desc: "New shop photo, selfie and recorded live video" },
                  { icon: FileSignature, step: "Step 6", title: "Accept agreement", desc: "Review and accept the agreement again" },
                  { icon: Send, step: "Step 7", title: "Resubmit", desc: "Send your application for another review" },
                ].map(({ icon: Icon, step, title, desc }) => (
                  <div key={step} className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                    <span className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-white border border-slate-200 text-blue-700 mb-3">
                      <Icon className="w-4 h-4" />
                    </span>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700 mb-1">{step}</p>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">{desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onRefresh}
                disabled={isRestarting}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" /> Refresh status
              </button>
              <button
                type="button"
                onClick={onRestart}
                disabled={isRestarting || !previousStepsVerified}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-white text-sm font-semibold bg-blue-600 hover:bg-blue-700 shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isRestarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                {isRestarting ? "Restarting your KYC..." : "Restart KYC from Step 5"}
                {!isRestarting && <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-500">
          Your previous media records remain in the compliance history. New uploads are required for this attempt.
        </p>
      </main>
    </div>
  );
}

export default KycRejectedView;
