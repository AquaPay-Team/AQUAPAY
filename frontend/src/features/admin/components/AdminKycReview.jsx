import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  ExternalLink,
  FileCheck2,
  FileText,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldX,
  UserRound,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  approveAdminKyc,
  getAdminKycDetails,
  getAdminKycDocument,
  listAdminKycApplications,
  rejectAdminKyc,
} from "../services/adminKycApi";

const FILTERS = [
  { value: "", label: "Awaiting review" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under review" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const statusStyles = {
  submitted: "bg-blue-50 text-blue-700 border-blue-200/80",
  under_review: "bg-amber-50 text-amber-700 border-amber-200/80",
  approved: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  rejected: "bg-rose-50 text-rose-700 border-rose-200/80",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  verified: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
  pending: "bg-slate-100 text-slate-600 border-slate-200",
};

const pretty = (value) => value == null || value === ""
  ? "—"
  : String(value).replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value) => {
  if (!value) return "—";
  const result = new Date(value);
  return Number.isNaN(result.getTime()) ? "—" : result.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
};

const errorText = (error) => error?.response?.data?.message || "Something went wrong. Please try again.";
const panel = "bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden";
const secondaryButton = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
const primaryButton = "inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

function StatusBadge({ status }) {
  const normalized = String(status || "pending").toLowerCase();
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold capitalize whitespace-nowrap ${statusStyles[normalized] || statusStyles.pending}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${normalized === "approved" || normalized === "completed" || normalized === "verified" ? "bg-emerald-500" : normalized === "rejected" ? "bg-rose-500" : normalized === "submitted" ? "bg-blue-500" : normalized === "under_review" ? "bg-amber-500" : "bg-slate-400"}`} />
      {pretty(status || "pending")}
    </span>
  );
}

function DetailLine({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-xs font-semibold text-slate-800">{value || "—"}</dd>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-3 flex items-start gap-2.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

export default function AdminKycReview() {
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [applications, setApplications] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [details, setDetails] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [decision, setDecision] = useState(null);
  const [busy, setBusy] = useState(false);
  const listRequestRef = useRef(0);
  const detailRequestRef = useRef(0);

  const loadList = useCallback(async () => {
    const requestId = ++listRequestRef.current;
    setLoading(true);
    setListError("");
    try {
      const result = await listAdminKycApplications({ ...(status ? { status } : {}), page, limit: 10 });
      if (requestId !== listRequestRef.current) return;
      setApplications(Array.isArray(result?.applications) ? result.applications : []);
      setPagination(result?.pagination || {});
    } catch (error) {
      if (requestId !== listRequestRef.current) return;
      setListError(errorText(error));
      setApplications([]);
    } finally {
      if (requestId === listRequestRef.current) setLoading(false);
    }
  }, [page, status]);

  useEffect(() => {
    loadList();
    return () => { listRequestRef.current += 1; };
  }, [loadList]);

  const closeCase = () => {
    if (busy) return;
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetails(null);
    setDecision(null);
    setReason("");
  };

  const openCase = async (caseId) => {
    const requestId = ++detailRequestRef.current;
    setSelectedId(caseId);
    setDetails(null);
    setDecision(null);
    setReason("");
    setDetailLoading(true);
    try {
      const result = await getAdminKycDetails(caseId);
      if (requestId === detailRequestRef.current) setDetails(result);
    } catch (error) {
      if (requestId === detailRequestRef.current) {
        toast.error(errorText(error));
        setSelectedId(null);
      }
    } finally {
      if (requestId === detailRequestRef.current) setDetailLoading(false);
    }
  };

  const viewDocument = async (assetId) => {
    // Open the tab from the click event to avoid popup blocking after the API response.
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await getAdminKycDocument(selectedId, assetId);
      if (!result?.documentUrl || !/^https:\/\//i.test(result.documentUrl)) {
        throw new Error("Secure document link is unavailable.");
      }
      if (tab) tab.location.replace(result.documentUrl);
      else toast.error("Your browser blocked the document tab. Allow popups and try again.");
    } catch (error) {
      tab?.close();
      toast.error(error?.response ? errorText(error) : (error?.message || "Unable to open document."));
    }
  };

  const submitDecision = async () => {
    if (!decision || busy || !selectedId) return;
    const trimmedReason = reason.trim();
    if (decision === "reject" && (trimmedReason.length < 1 || trimmedReason.length > 500)) {
      toast.error("Please enter a rejection reason of 1–500 characters.");
      return;
    }
    setBusy(true);
    try {
      if (decision === "approve") await approveAdminKyc(selectedId);
      else await rejectAdminKyc(selectedId, trimmedReason);
      toast.success(decision === "approve" ? "KYC application approved." : "KYC application rejected.");
      closeCaseAfterDecision();
      await loadList();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const closeCaseAfterDecision = () => {
    detailRequestRef.current += 1;
    setSelectedId(null);
    setDetails(null);
    setDecision(null);
    setReason("");
  };

  const visibleApplications = applications.filter((item) => {
    const query = search.trim().toLowerCase();
    return !query || [item.case_id, item.user_id, item.name, item.email, item.mobile]
      .some((value) => String(value ?? "").toLowerCase().includes(query));
  });
  const selectedFilter = FILTERS.find((item) => item.value === status)?.label || "Awaiting review";
  const application = details?.application;
  const actionable = ["submitted", "under_review"].includes(application?.kyc_status);

  return (
    <section className="mx-auto max-w-7xl space-y-5 pb-10">
      {/* Match the existing AquaPay dashboard's breadcrumb and title rhythm. */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span>Admin</span><span>/</span><span className="font-semibold text-slate-700">KYC Compliance</span>
          </div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-slate-900">
            KYC Applications
          </h1>
          <p className="mt-0.5 text-xs text-slate-400">Review merchant submissions and verify supporting information.</p>
        </div>
        <button type="button" className={secondaryButton} onClick={loadList} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh applications
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-blue-100/80 bg-blue-50/60 p-5 shadow-2xs">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><ClipboardCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Applications in selected filter</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{loading ? "—" : (pagination.total ?? 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><ShieldCheck className="h-5 w-5" /></span>
          <div>
            <p className="text-[11px] font-semibold text-slate-500">Current queue</p>
            <p className="mt-1 text-sm font-bold text-slate-900">{selectedFilter}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">Live backend KYC records</p>
          </div>
        </div>
      </div>

      <div className={panel}>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:p-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">Merchant KYC Records</h2>
            <p className="mt-1 text-xs text-slate-400">Select an application to review its verification and document history.</p>
          </div>
          <span className="self-start rounded-xl border border-blue-200/80 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700 sm:self-auto">
            {pagination.total ?? 0} Records
          </span>
        </div>
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 bg-slate-50/40 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} type="search"
              aria-label="Search applications on this page" placeholder="Search name, email, mobile or ID on this page..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500" />
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Filter className="h-4 w-4 text-slate-400" />
            <label htmlFor="admin-kyc-filter" className="font-medium">Status</label>
            <select id="admin-kyc-filter" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); setSearch(""); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-500">
              {FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
            </select>
          </div>
        </div>

        {listError && (
          <div role="alert" className="m-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-medium text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" /><span>{listError}</span>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="min-w-[100px] px-5 py-3">Case ID</th>
                <th className="min-w-[230px] px-5 py-3">Merchant & Contact</th>
                <th className="min-w-[145px] px-5 py-3">KYC Status</th>
                <th className="min-w-[170px] px-5 py-3">Submitted</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading KYC applications...</td></tr>
              ) : !visibleApplications.length ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center">
                  <FileCheck2 className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No KYC applications found</p>
                  <p className="mt-1 text-xs text-slate-400">{search ? "Try a different search on this page." : "Try another status filter or refresh the list."}</p>
                </td></tr>
              ) : visibleApplications.map((item) => (
                <tr key={item.case_id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-bold text-slate-700">#{item.case_id}</td>
                  <td className="px-5 py-4">
                    <div className="font-semibold text-slate-800">{item.name || "—"}</div>
                    <div className="mt-1 max-w-[250px] truncate text-[11px] text-slate-400">{item.email || item.mobile || "—"}</div>
                  </td>
                  <td className="px-5 py-4"><StatusBadge status={item.kyc_status} /></td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(item.submitted_at)}</td>
                  <td className="px-5 py-4 text-right">
                    <button type="button" onClick={() => openCase(item.case_id)} className={secondaryButton}>
                      <FileText className="h-3.5 w-3.5" /> View details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>{pagination.total ?? 0} total records · Page {pagination.page ?? page} of {Math.max(1, pagination.totalPages || 1)}</p>
          <div className="flex gap-2">
            <button type="button" className={secondaryButton} disabled={loading || !pagination.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button type="button" className={secondaryButton} disabled={loading || !pagination.hasNextPage} onClick={() => setPage((current) => current + 1)}>
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {selectedId != null && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/40 p-3 backdrop-blur-xs sm:p-6"
          role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeCase(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="kyc-review-title"
            className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl sm:my-8">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4 sm:px-6">
              <div>
                <p className="mb-1 text-[11px] font-semibold text-blue-600">KYC Compliance / Application</p>
                <h2 id="kyc-review-title" className="text-base font-bold text-slate-900 sm:text-lg">Application #{selectedId}</h2>
                <p className="mt-0.5 text-xs text-slate-400">Review submitted information before making a decision.</p>
              </div>
              <button type="button" aria-label="Close review" disabled={busy} onClick={closeCase}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[calc(100vh-12rem)] space-y-5 overflow-y-auto p-5 sm:p-6">
              {detailLoading && <div className="flex justify-center gap-2 py-16 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading application details...</div>}
              {application && (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600"><UserRound className="h-5 w-5" /></span>
                      <div><p className="text-sm font-bold text-slate-900">{application.name || "Merchant"}</p><p className="text-[11px] text-slate-500">Merchant #{application.user_id}</p></div>
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
                      <div className="mb-1 flex items-center gap-2 font-bold"><AlertCircle className="h-4 w-4" /> Rejection reason</div>
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
                              <p className="mt-0.5 text-[11px] text-slate-400">{[item.masked_identifier, item.verified_name].filter(Boolean).join(" · ") || pretty(item.provider)}</p>
                            </div>
                            <StatusBadge status={item.status} />
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">No verification records available.</p>}
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
                    ) : <p className="text-xs text-slate-400">No bank account details available.</p>}
                  </section>

                  <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                    <SectionTitle icon={FileText} title="Uploaded media" subtitle="Shop image, selfie, and recorded KYC video history" />
                    {details.media?.length ? (
                      <div className="divide-y divide-slate-100">
                        {details.media.map((item) => (
                          <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                            <div>
                              <p className="text-xs font-semibold text-slate-800">{pretty(item.asset_type)} <span className="font-normal text-slate-400">· #{item.id}</span></p>
                              <p className="mt-1 text-[11px] text-slate-400">{pretty(item.status)} · {formatDate(item.created_at)}</p>
                            </div>
                            <button type="button" className={secondaryButton} onClick={() => viewDocument(item.id)}>
                              <ExternalLink className="h-3.5 w-3.5" /> Open securely
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">No uploaded media available.</p>}
                  </section>

                  <section className="rounded-xl border border-slate-200/80 p-4 sm:p-5">
                    <SectionTitle icon={FileCheck2} title="Agreement history" subtitle="Recorded merchant agreement acceptances" />
                    {details.agreements?.length ? (
                      <div className="divide-y divide-slate-100">
                        {details.agreements.map((item, index) => (
                          <div key={`${item.agreement_code}-${index}`} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                            <div><p className="font-semibold text-slate-800">{item.agreement_code || "Agreement"}</p><p className="mt-1 text-[11px] text-slate-400">Version {item.agreement_version || "—"}</p></div>
                            <span className="text-[11px] text-slate-500">{formatDate(item.accepted_at)}</span>
                          </div>
                        ))}
                      </div>
                    ) : <p className="text-xs text-slate-400">No agreement records available.</p>}
                  </section>

                  {actionable && (
                    <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:p-5">
                      <SectionTitle icon={ShieldCheck} title="Review decision" subtitle="Only submitted or under-review KYC can be approved or rejected" />
                      {!decision ? (
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className={primaryButton} onClick={() => setDecision("approve")}><CheckCircle2 className="h-4 w-4" /> Approve KYC</button>
                          <button type="button" className={`${secondaryButton} border-rose-200 text-rose-700 hover:bg-rose-50`} onClick={() => setDecision("reject")}><ShieldX className="h-4 w-4" /> Reject KYC</button>
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start gap-2 text-xs font-semibold text-slate-800">
                            {decision === "approve" ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertCircle className="h-4 w-4 text-rose-600" />}
                            Confirm {decision === "approve" ? "approval" : "rejection"} for application #{selectedId}?
                          </div>
                          {decision === "reject" && (
                            <div>
                              <label htmlFor="admin-kyc-reason" className="mb-1.5 block text-xs font-semibold text-slate-700">Rejection reason <span className="text-rose-600">*</span></label>
                              <textarea id="admin-kyc-reason" rows={3} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why this application is being rejected..."
                                className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-blue-500" />
                              <p className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/500 characters</p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            <button type="button" className={primaryButton} onClick={submitDecision}
                              disabled={busy || (decision === "reject" && !reason.trim())}>
                              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                              {busy ? "Saving decision..." : `Confirm ${decision === "approve" ? "approval" : "rejection"}`}
                            </button>
                            <button type="button" className={secondaryButton} disabled={busy} onClick={() => { setDecision(null); setReason(""); }}><ArrowLeft className="h-3.5 w-3.5" /> Cancel</button>
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
      )}
    </section>
  );
}
