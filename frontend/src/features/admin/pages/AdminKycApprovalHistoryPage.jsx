import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileSearch,
  Loader2,
} from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { useRecentAdminKycApplications } from "../hooks/useAdminDashboardSummary";

const LIMIT = 25;
const button = "inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50";

function indiaDateToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function approvalDayBounds(dateValue) {
  const [year, month, day] = String(dateValue).split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);

  return {
    reviewedFrom: `${dateValue}T00:00:00+05:30`,
    reviewedTo: `${next}T00:00:00+05:30`,
  };
}

function formatApprovalDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      dateStyle: "medium",
      timeStyle: "short",
    });
}

export default function AdminKycApprovalHistoryPage() {
  const [date, setDate] = useState(indiaDateToday);
  const [page, setPage] = useState(1);
  const bounds = useMemo(() => approvalDayBounds(date), [date]);
  const query = useRecentAdminKycApplications({
    status: "approved",
    page,
    limit: LIMIT,
    ...bounds,
  });
  const applications = query.data?.applications || [];
  const pagination = query.data?.pagination;

  return (
    <section className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><span>Admin</span><span>/</span><span>KYC Management</span><span>/</span><span className="font-semibold text-slate-700">Approval History</span></div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">KYC Approval History</h1>
          <p className="mt-1 text-xs text-slate-500">Applications approved by an Admin, based on the Admin review timestamp in Asia/Kolkata.</p>
        </div>
        <Link to="/admin/kyc" className={button}><ClipboardCheck className="h-4 w-4" /> Pending KYC reviews</Link>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-2xs">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-base font-bold text-slate-900">Approvals for selected day</h2>
            <p className="mt-1 text-xs text-slate-400">Provider verification timestamps are not used.</p>
          </div>
          <label className="text-xs font-semibold text-slate-600">Approval date (Asia/Kolkata)<input type="date" value={date} onChange={(event) => { setDate(event.target.value || indiaDateToday()); setPage(1); }} className="mt-1.5 block rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 outline-none focus:border-blue-500" /></label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Case ID</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Approved at</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {query.isLoading ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500"><Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin text-blue-600" />Loading approval history…</td></tr>
              ) : query.isError ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center"><AlertCircle className="mx-auto mb-2 h-6 w-6 text-rose-500" /><p className="text-sm font-semibold text-rose-700">Could not load approval history</p><p className="mt-1 text-xs text-slate-500">{parseApiError(query.error).message || "Try again later."}</p></td></tr>
              ) : !applications.length ? (
                <tr><td colSpan={5} className="px-5 py-12 text-center"><FileSearch className="mx-auto mb-2 h-7 w-7 text-slate-300" /><p className="text-sm font-semibold text-slate-700">No Admin approvals for this day</p><p className="mt-1 text-xs text-slate-400">Choose another date or review the pending KYC queue.</p></td></tr>
              ) : applications.map((application) => (
                <tr key={application.case_id} className="transition-colors hover:bg-slate-50/80">
                  <td className="px-5 py-4 font-bold text-slate-700">#{application.case_id}</td>
                  <td className="px-5 py-4"><div className="font-semibold text-slate-800">{application.name || "—"}</div><div className="mt-1 text-[11px] text-slate-400">User ID #{application.user_id}</div></td>
                  <td className="px-5 py-4"><span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" /> Approved</span></td>
                  <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatApprovalDate(application.reviewed_at)}</td>
                  <td className="px-5 py-4 text-right"><Link to={`/admin/kyc?caseId=${encodeURIComponent(application.case_id)}&status=approved`} className={button}>View details</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>{pagination?.total ?? 0} total approvals · Page {pagination?.page || 1} of {Math.max(1, pagination?.totalPages || 1)}</p>
          <div className="flex gap-2"><button type="button" className={button} disabled={query.isFetching || !pagination?.hasPreviousPage} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-3.5 w-3.5" /> Previous</button><button type="button" className={button} disabled={query.isFetching || !pagination?.hasNextPage} onClick={() => setPage((current) => current + 1)}>Next <ChevronRight className="h-3.5 w-3.5" /></button></div>
        </div>
      </div>
    </section>
  );
}
