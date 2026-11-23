import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, BadgeCheck, Clock3, RefreshCw, ShieldAlert, ShieldCheck, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { parseApiError } from "@/lib/errors";

const tones = {
  blue: { card: "border-blue-200/90 bg-blue-50/60", watermark: "text-blue-200/40", detail: "text-blue-600" },
  emerald: { card: "border-emerald-200/90 bg-emerald-50/60", watermark: "text-emerald-200/40", detail: "text-emerald-600" },
  rose: { card: "border-rose-200/90 bg-rose-50/60", watermark: "text-rose-200/40", detail: "text-rose-600" },
  amber: { card: "border-amber-200/90 bg-amber-50/60", watermark: "text-amber-200/40", detail: "text-amber-600" },
  violet: { card: "border-violet-200/90 bg-violet-50/60", watermark: "text-violet-200/40", detail: "text-violet-600" },
  cyan: { card: "border-cyan-200/90 bg-cyan-50/60", watermark: "text-cyan-200/40", detail: "text-cyan-600" },
};

function formatCount(value, pending) {
  if (pending) return "-";
  return new Intl.NumberFormat("en-IN").format(Number(value || 0));
}

function MetricCard({ label, value, detail, icon: Icon, tone, onClick, prominent = false }) {
  const content = <>
    <div className="flex items-start justify-between gap-3">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/90 ${tone.detail}`}><Icon className="h-4 w-4" /></span>
      {onClick && <ArrowRight className="mt-1 h-4 w-4 text-slate-500 transition-transform group-hover:translate-x-0.5" />}
    </div>
    <span className="mt-5 block text-xs font-semibold text-slate-600">{label}</span>
    <span className="mt-1.5 block text-2xl font-bold tracking-tight text-slate-900">{value}</span>
    <p className={`mt-2 text-xs ${tone.detail}`}>{detail}</p>
  </>;
  const className = `group min-h-40 rounded-2xl border p-5 text-left shadow-2xs transition-all ${tone.card} ${prominent ? "ring-1 ring-amber-300/90" : ""} ${onClick ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md" : ""}`;
  return onClick ? <button type="button" onClick={onClick} className={className}>{content}</button> : <div className={className}>{content}</div>;
}

function QuickAccessCard({ label, description, icon: Icon, onClick }) {
  return <button type="button" onClick={onClick} className="group flex min-h-26 items-center gap-3 rounded-2xl border border-slate-300 bg-white p-4 text-left shadow-2xs transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icon className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{label}</span><span className="mt-1 block text-xs text-slate-600">{description}</span></span>
    <ArrowRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-hover:translate-x-0.5" />
  </button>;
}

export function DashboardOverview({ summary, isLoading = false, isError = false, error, isFetching = false, dataUpdatedAt = null, refresh = () => {} }) {
  const navigate = useNavigate();
  const users = summary?.users || {};
  const kyc = summary?.kyc || {};
  const registrations = summary?.registrations || {};
  const pending = isLoading || isError;
  const errorMessage = parseApiError(error).message || "Unable to load dashboard metrics.";
  const pendingCount = formatCount(kyc.pendingReview, pending);
  const updatedJustNow = !isLoading && Boolean(dataUpdatedAt) && Date.now() - dataUpdatedAt < 30000;
  const metrics = [
    { label: "Total Users", value: formatCount(users.total, pending), detail: "All registered accounts", icon: Users, tone: tones.blue, onClick: () => navigate("/admin/users") },
    { label: "Active Accounts", value: formatCount(users.active, pending), detail: "Accounts with active status", icon: UserCheck, tone: tones.emerald },
    { label: "Inactive Accounts", value: formatCount(users.inactive, pending), detail: "Accounts with inactive status", icon: UserX, tone: tones.rose },
    { label: "Awaiting Admin Decision", value: pendingCount, detail: "Submitted + Under Review", icon: ShieldAlert, tone: tones.amber, prominent: true, onClick: () => navigate("/admin/kyc") },
    { label: "KYC Approved Today", value: formatCount(kyc.approvedToday, pending), detail: "Admin decisions recorded today", icon: BadgeCheck, tone: tones.violet, onClick: () => navigate("/admin/kyc/approval-history") },
    { label: "New Registrations", value: formatCount(registrations.today, pending), detail: pending ? "Today - This month -" : `Today - This month ${formatCount(registrations.thisMonth, false)}`, icon: UserPlus, tone: tones.cyan },
  ];
  const quickAccess = [
    { label: "User Directory", description: "Manage registered users", icon: Users, onClick: () => navigate("/admin/users") },
    { label: "KYC Management", description: "Review KYC applications", icon: ShieldCheck, onClick: () => navigate("/admin/kyc") },
    { label: "KYC Approval History", description: "View Admin approvals", icon: Clock3, onClick: () => navigate("/admin/kyc/approval-history") },
  ];

  return <section className="mx-auto max-w-7xl space-y-7 pb-10">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h1 className="text-xl font-bold tracking-tight text-slate-900">Admin Dashboard</h1><p className="mt-0.5 text-xs text-slate-600">Operational overview of users, KYC activity, and platform health.</p></div><div className="flex flex-wrap items-center gap-3"><span className="text-xs text-slate-500">{updatedJustNow ? "Updated just now" : ""}</span><button type="button" onClick={() => refresh()} disabled={isFetching} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin text-blue-600" : "text-slate-700"}`} />Refresh</button></div></div>
    {isError && <div role="alert" className="flex flex-col justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 sm:flex-row sm:items-center"><div className="flex items-start gap-2"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><span>{errorMessage}</span></div><button type="button" onClick={() => refresh()} className="text-left text-xs font-bold text-rose-700 underline underline-offset-2">Try again</button></div>}
    <section aria-labelledby="business-overview-title"><div className="mb-3"><h2 id="business-overview-title" className="text-base font-bold text-slate-900">Business Overview</h2><p className="mt-0.5 text-xs text-slate-600">Current platform totals from the Admin summary.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">{metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}</div></section>
    <section aria-labelledby="pending-actions-title" className="rounded-2xl border border-amber-300/90 bg-amber-50/80 p-5 shadow-2xs"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex items-start gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700"><ShieldAlert className="h-5 w-5" /></span><div><h2 id="pending-actions-title" className="text-base font-bold text-slate-900">KYC Applications Awaiting Review</h2><p className="mt-1 text-xs text-slate-700">There {pendingCount === "1" ? "is" : "are"} <span className="font-bold text-slate-900">{pendingCount}</span> application{pendingCount === "1" ? "" : "s"} submitted or under review.</p></div></div><button type="button" onClick={() => navigate("/admin/kyc")} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-700"><ShieldCheck className="h-4 w-4" />Review Pending Applications</button></div></section>
    <section aria-labelledby="quick-access-title"><div className="mb-3"><h2 id="quick-access-title" className="text-base font-bold text-slate-900">Quick Access</h2><p className="mt-0.5 text-xs text-slate-600">Common administration destinations.</p></div><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">{quickAccess.map((item) => <QuickAccessCard key={item.label} {...item} />)}</div></section>
  </section>;
}

export default DashboardOverview;
