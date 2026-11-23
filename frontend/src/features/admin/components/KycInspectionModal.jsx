import React from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileText,
  Loader2,
  ShieldCheck,
  ShieldX,
  UserRound,
  X,
} from "lucide-react";

export function KycInspectionModal({
  selectedId,
  closeCase,
  busy,
  detailLoading,
  details,
  viewDocument,
  decision,
  setDecision,
  reason,
  setReason,
  submitDecision,
  pretty,
  formatDate,
  StatusBadge,
  SectionTitle,
  DetailLine,
  primaryButton,
  secondaryButton,
}) {
  if (selectedId == null) return null;

  const application = details?.application;
  const actionable = ["submitted", "under_review"].includes(application?.kyc_status);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closeCase();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kyc-review-title"
        className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:my-8"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="mb-1 text-[11px] font-semibold text-blue-600">KYC Compliance / Application</p>
            <h2 id="kyc-review-title" className="text-base font-bold text-slate-900 sm:text-lg">
              Application #{selectedId}
            </h2>
            <p className="mt-0.5 text-xs text-slate-400">Review submitted information before making a decision.</p>
          </div>
          <button
            type="button"
            aria-label="Close review"
            disabled={busy}
            onClick={closeCase}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
          {detailLoading && (
            <div className="flex justify-center gap-2 py-16 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading application details...
            </div>
          )}

          {application && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                    <UserRound className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{application.name || "Merchant"}</p>
                    <p className="text-[11px] text-slate-500">Merchant #{application.user_id}</p>
                  </div>
                </div>
                <StatusBadge status={application.kyc_status} />
              </div>

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={UserRound} title="Merchant information" subtitle="Details linked to this KYC application" />
                <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                  <DetailLine label="Full name" value={application.name} />
                  <DetailLine label="Mobile number" value={application.mobile} />
                  <DetailLine label="Email address" value={application.email} />
                  <DetailLine label="Business type" value={pretty(application.business_type)} />
                  <DetailLine label="Location" value={[application.city, application.pincode].filter(Boolean).join(" · ")} />
                  <DetailLine label="Submitted on" value={formatDate(application.submitted_at)} />
                </dl>
              </section>

              {application.rejection_reason && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700">
                  <div className="mb-1 flex items-center gap-2 font-bold">
                    <AlertCircle className="h-4 w-4" /> Rejection reason
                  </div>
                  <p className="break-words leading-relaxed">{application.rejection_reason}</p>
                </div>
              )}

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={ClipboardCheck} title="KYC step progress" subtitle="Recorded completion states for steps 1–7" />
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(details.steps || []).map((step) => (
                    <div key={step.step_number} className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                      <p className="mb-2 text-[11px] font-bold text-slate-700">Step {step.step_number}</p>
                      <StatusBadge status={step.status} />
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={BadgeCheck} title="Identity verification" subtitle="Verified identity metadata, without sensitive identity payloads" />
                {details.verifications?.length ? (
                  <div className="divide-y divide-slate-100">
                    {details.verifications.map((item, index) => (
                      <div key={`${item.verification_type}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{pretty(item.verification_type)}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {[item.masked_identifier, item.verified_name].filter(Boolean).join(" · ") || pretty(item.provider)}
                          </p>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No verification records available.</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={ShieldCheck} title="Bank verification" subtitle="Masked account information provided by the backend" />
                {details.bankAccount ? (
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                    <DetailLine label="Account holder" value={details.bankAccount.account_holder_name} />
                    <DetailLine label="Bank" value={details.bankAccount.bank_name} />
                    <DetailLine label="Account" value={`•••• ${details.bankAccount.account_number_last4 || "—"}`} />
                    <DetailLine label="IFSC" value={details.bankAccount.ifsc_code} />
                    <DetailLine label="Verification" value={pretty(details.bankAccount.verification_status)} />
                    <DetailLine label="Verified on" value={formatDate(details.bankAccount.verified_at)} />
                  </dl>
                ) : (
                  <p className="text-xs text-slate-400">No bank account details available.</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={FileText} title="Uploaded media" subtitle="Shop image, selfie, and recorded KYC video history" />
                {details.media?.length ? (
                  <div className="divide-y divide-slate-100">
                    {details.media.map((item) => (
                      <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                        <div>
                          <p className="text-xs font-semibold text-slate-800">
                            {pretty(item.asset_type)} <span className="font-normal text-slate-400">· #{item.id}</span>
                          </p>
                          <p className="mt-1 text-[11px] text-slate-400">
                            {pretty(item.status)} · {formatDate(item.created_at)}
                          </p>
                        </div>
                        <button type="button" className={secondaryButton} onClick={() => viewDocument(item.id)}>
                          <ExternalLink className="h-3.5 w-3.5" /> Open securely
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No uploaded media available.</p>
                )}
              </section>

              <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                <SectionTitle icon={FileCheck2} title="Agreement history" subtitle="Recorded merchant agreement acceptances" />
                {details.agreements?.length ? (
                  <div className="divide-y divide-slate-100">
                    {details.agreements.map((item, index) => (
                      <div key={`${item.agreement_code}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                        <div>
                          <p className="font-semibold text-slate-800">{item.agreement_code || "Agreement"}</p>
                          <p className="mt-1 text-[11px] text-slate-400">Version {item.agreement_version || "—"}</p>
                        </div>
                        <span className="text-[11px] text-slate-500">{formatDate(item.accepted_at)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">No agreement records available.</p>
                )}
              </section>

              {actionable && (
                <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                  <SectionTitle icon={ShieldCheck} title="Review decision" subtitle="Only submitted or under-review KYC can be approved or rejected" />
                  {!decision ? (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className={primaryButton} onClick={() => setDecision("approve")}>
                        <CheckCircle2 className="h-4 w-4" /> Approve KYC
                      </button>
                      <button
                        type="button"
                        className={`${secondaryButton} border-rose-200 text-rose-700 hover:bg-rose-50`}
                        onClick={() => setDecision("reject")}
                      >
                        <ShieldX className="h-4 w-4" /> Reject KYC
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                        {decision === "approve" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-rose-600" />
                        )}
                        Confirm {decision === "approve" ? "approval" : "rejection"} for application #{selectedId}?
                      </div>
                      {decision === "reject" && (
                        <div>
                          <label htmlFor="admin-kyc-reason" className="mb-1.5 block text-xs font-semibold text-slate-700">
                            Rejection reason <span className="text-rose-600">*</span>
                          </label>
                          <textarea
                            id="admin-kyc-reason"
                            rows={3}
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            placeholder="Explain why this application is being rejected..."
                            className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500"
                          />
                          <p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/500 characters</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          className={primaryButton}
                          onClick={submitDecision}
                          disabled={busy || (decision === "reject" && !reason.trim())}
                        >
                          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                          {busy ? "Saving decision..." : `Confirm ${decision === "approve" ? "approval" : "rejection"}`}
                        </button>
                        <button
                          type="button"
                          className={secondaryButton}
                          disabled={busy}
                          onClick={() => {
                            setDecision(null);
                            setReason("");
                          }}
                        >
                          <ArrowLeft className="h-3.5 w-3.5" /> Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}
              {!actionable && (
                <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                  <CalendarDays className="h-4 w-4 shrink-0" /> This application is not currently eligible for an admin review decision.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default KycInspectionModal;
