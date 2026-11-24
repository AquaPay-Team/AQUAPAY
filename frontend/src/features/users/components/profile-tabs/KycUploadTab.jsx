import React, { useState } from "react";
import {
  BadgeCheck,
  ShieldCheck,
  FileText,
  FileCheck2,
  UserRound,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  ShieldX,
  ExternalLink,
  Loader2,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseApiError } from "@/lib/errors";
import {
  approveAdminKyc,
  rejectAdminKyc,
  getAdminKycDocument,
} from "@/features/admin/services/adminKycApi";
import { queryClient } from "@/lib/queryClient";

const kycStatusStyles = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200/80",
  under_review: "bg-amber-50 text-amber-700 border-amber-200/80",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  rejected: "bg-rose-50 text-rose-700 border-rose-200/80",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
};

const prettyKycText = (value) =>
  value == null || value === ""
    ? "—"
    : String(value).replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

const formatKycDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

export function KycUploadTab({
  kycData,
  kycLoading,
  kycError,
  loadKycDetails,
  admin,
  onKycUpdated,
}) {
  const [kycDecision, setKycDecision] = useState(null); // 'approve' | 'reject' | null
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [kycActionBusy, setKycActionBusy] = useState(false);

  const handleViewDocument = async (assetId) => {
    if (!kycData?.application?.case_id) return;
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await getAdminKycDocument(kycData.application.case_id, assetId);
      if (!result?.documentUrl || !/^https:\/\//i.test(result.documentUrl)) {
        throw new Error("Secure document link is unavailable.");
      }
      if (tab) tab.location.replace(result.documentUrl);
      else toast.error("Your browser blocked the document tab. Allow popups and try again.");
    } catch (err) {
      tab?.close();
      toast.error(
        err?.response
          ? parseApiError(err).message || "Unable to open document."
          : err?.message || "Unable to open document."
      );
    }
  };

  const handleDecision = async () => {
    if (!kycDecision || kycActionBusy || !kycData?.application?.case_id) return;
    const caseId = kycData.application.case_id;
    const trimmedReason = kycRejectReason.trim();

    if (kycDecision === "reject" && (trimmedReason.length < 1 || trimmedReason.length > 500)) {
      toast.error("Please enter a rejection reason of 1–500 characters.");
      return;
    }

    setKycActionBusy(true);
    try {
      if (kycDecision === "approve") {
        await approveAdminKyc(caseId);
        toast.success("KYC application approved successfully.");
      } else {
        await rejectAdminKyc(caseId, trimmedReason);
        toast.success("KYC application rejected.");
      }
      setKycDecision(null);
      setKycRejectReason("");
      if (loadKycDetails) await loadKycDetails();
      if (onKycUpdated) await onKycUpdated();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-kyc"] });
    } catch (err) {
      toast.error(parseApiError(err).message || "Action failed.");
    } finally {
      setKycActionBusy(false);
    }
  };

  if (kycLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-xs text-slate-500 shadow-2xs">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-3" />
        Loading complete KYC compliance dossier...
      </div>
    );
  }

  if (kycError) {
    return (
      <div className="bg-white rounded-2xl border border-rose-200 p-6 shadow-2xs flex items-center justify-between text-xs text-rose-700">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{kycError}</span>
        </div>
        <Button variant="outline" size="sm" onClick={loadKycDetails}>
          Retry
        </Button>
      </div>
    );
  }

  if (!kycData) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center shadow-2xs space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
          <BadgeCheck className="w-6 h-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-slate-800">No KYC Application Found</h4>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            This user has not initiated or submitted a KYC compliance case yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Overview Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
              <UserRound className="h-5 w-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Application #{kycData.application?.case_id}
              </h3>
              <p className="text-[11px] text-slate-400">
                Submitted: {formatKycDate(kycData.application?.submitted_at)} · Type:{" "}
                {prettyKycText(kycData.application?.business_type)}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold capitalize ${
              kycStatusStyles[kycData.application?.kyc_status] || kycStatusStyles.pending
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current" />
            {prettyKycText(kycData.application?.kyc_status || "pending")}
          </span>
        </div>

        {kycData.application?.rejection_reason && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-700 space-y-1">
            <div className="flex items-center gap-2 font-bold">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Rejection Reason</span>
            </div>
            <p className="leading-relaxed pl-6">{kycData.application.rejection_reason}</p>
          </div>
        )}

        {/* Step Progress */}
        <div>
          <h4 className="text-xs font-bold text-slate-800 mb-2.5">
            KYC Step Progress ({kycData.steps?.filter((s) => s.status === "completed").length || 0}{" "}
            of 7 steps)
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
            {(kycData.steps || []).map((step) => (
              <div
                key={step.step_number}
                className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 text-center"
              >
                <p className="text-[11px] font-bold text-slate-700">Step {step.step_number}</p>
                <span
                  className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-md border ${
                    kycStatusStyles[step.status] || kycStatusStyles.pending
                  }`}
                >
                  {prettyKycText(step.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Identity & Bank Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity Verifications (Aadhaar & PAN) */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <BadgeCheck className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900">Identity Verifications</h4>
          </div>
          {kycData.verifications?.length ? (
            <div className="divide-y divide-slate-100">
              {kycData.verifications.map((item, index) => (
                <div
                  key={`${item.verification_type}-${index}`}
                  className="py-3 flex items-center justify-between text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-800 capitalize">
                      {prettyKycText(item.verification_type)}
                    </p>
                    <p className="text-slate-500 font-mono mt-0.5">
                      {item.masked_identifier || "—"}
                    </p>
                    {item.verified_name && (
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Name: {item.verified_name}
                      </p>
                    )}
                  </div>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                      kycStatusStyles[item.status] || kycStatusStyles.pending
                    }`}
                  >
                    {prettyKycText(item.status)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-3">No identity verification records available.</p>
          )}
        </div>

        {/* Bank Verification */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <h4 className="text-sm font-bold text-slate-900">Bank Account Details</h4>
          </div>
          {kycData.bankAccount ? (
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-slate-400 font-medium">Account Holder</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">
                  {kycData.bankAccount.account_holder_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Bank Name</dt>
                <dd className="font-semibold text-slate-800 mt-0.5">
                  {kycData.bankAccount.bank_name || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">Account Number</dt>
                <dd className="font-semibold text-slate-800 font-mono mt-0.5">
                  •••• {kycData.bankAccount.account_number_last4 || "—"}
                </dd>
              </div>
              <div>
                <dt className="text-slate-400 font-medium">IFSC Code</dt>
                <dd className="font-semibold text-slate-800 font-mono mt-0.5">
                  {kycData.bankAccount.ifsc_code || "—"}
                </dd>
              </div>
              <div className="col-span-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400">Verification</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                    kycStatusStyles[kycData.bankAccount.verification_status] || kycStatusStyles.pending
                  }`}
                >
                  {prettyKycText(kycData.bankAccount.verification_status)}
                </span>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-slate-400 py-3">No bank account details recorded.</p>
          )}
        </div>
      </div>

      {/* Uploaded Documents */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileText className="w-4 h-4 text-blue-600" />
          <h4 className="text-sm font-bold text-slate-900">Uploaded Compliance Documents</h4>
        </div>
        {kycData.media?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {kycData.media.map((item) => (
              <div
                key={item.id}
                className="rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between gap-3 bg-slate-50/40"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 capitalize">
                    {prettyKycText(item.asset_type)}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Uploaded: {formatKycDate(item.created_at)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDocument(item.id)}
                  className="w-full text-xs font-semibold text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-blue-200"
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-1.5" /> Open securely
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">No uploaded media documents found.</p>
        )}
      </div>

      {/* Agreement History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
          <FileCheck2 className="w-4 h-4 text-emerald-600" />
          <h4 className="text-sm font-bold text-slate-900">Merchant Agreement History</h4>
        </div>
        {kycData.agreements?.length ? (
          <div className="divide-y divide-slate-100">
            {kycData.agreements.map((item, index) => (
              <div
                key={`${item.agreement_code}-${index}`}
                className="py-2.5 flex items-center justify-between text-xs"
              >
                <div>
                  <p className="font-semibold text-slate-800">{item.agreement_code}</p>
                  <p className="text-[11px] text-slate-400">
                    Version: {item.agreement_version || "1.0"}
                  </p>
                </div>
                <span className="text-[11px] text-slate-500 font-medium">
                  Accepted on {formatKycDate(item.accepted_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-slate-400 py-3">No agreement acceptances recorded.</p>
        )}
      </div>

      {/* Admin Decision Actions */}
      {admin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
            <Shield className="w-4 h-4 text-blue-600" />
            <h4 className="text-sm font-bold text-slate-900">Admin Review Decision</h4>
          </div>

          {["submitted", "under_review"].includes(kycData.application?.kyc_status) ? (
            !kycDecision ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  type="button"
                  onClick={() => setKycDecision("approve")}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1.5" /> Approve KYC
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setKycDecision("reject")}
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                >
                  <ShieldX className="w-4 h-4 mr-1.5" /> Reject KYC
                </Button>
              </div>
            ) : (
              <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  {kycDecision === "approve" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  Confirm {kycDecision === "approve" ? "approval" : "rejection"} for application #
                  {kycData.application?.case_id}?
                </div>

                {kycDecision === "reject" && (
                  <div>
                    <label
                      htmlFor="rejection-reason"
                      className="block text-xs font-semibold text-slate-700 mb-1"
                    >
                      Rejection Reason <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      id="rejection-reason"
                      rows={3}
                      maxLength={500}
                      value={kycRejectReason}
                      onChange={(e) => setKycRejectReason(e.target.value)}
                      placeholder="Explain clearly why this KYC application is being rejected..."
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none focus:border-blue-500"
                    />
                    <p className="text-right text-[11px] text-slate-400 mt-1">
                      {kycRejectReason.length}/500 characters
                    </p>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleDecision}
                    disabled={kycActionBusy || (kycDecision === "reject" && !kycRejectReason.trim())}
                    className={
                      kycDecision === "approve"
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-rose-600 hover:bg-rose-700 text-white"
                    }
                  >
                    {kycActionBusy && <Loader2 className="w-4 h-4 animate-spin mr-1.5" />}
                    {kycActionBusy
                      ? "Saving decision..."
                      : `Confirm ${kycDecision === "approve" ? "Approval" : "Rejection"}`}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={kycActionBusy}
                    onClick={() => {
                      setKycDecision(null);
                      setKycRejectReason("");
                    }}
                  >
                    <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Cancel
                  </Button>
                </div>
              </div>
            )
          ) : (
            <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-200">
              <CalendarDays className="w-4 h-4 text-slate-400" />
              <span>
                This application is currently {prettyKycText(kycData.application?.kyc_status)}. Only
                submitted or under-review applications can be approved or rejected.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default KycUploadTab;
