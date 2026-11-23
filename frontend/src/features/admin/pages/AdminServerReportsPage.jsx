import React from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  Loader2,
  RefreshCw,
  Server,
} from "lucide-react";
import { parseApiError } from "@/lib/errors";
import { useAdminOperationsOverview } from "../hooks/useAdminOperationsOverview";

const panel = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs";

function formatUptime(seconds) {
  const total = Math.max(0, Number(seconds) || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return [days && `${days}d`, hours && `${hours}h`, `${minutes}m`].filter(Boolean).join(" ");
}

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function ReadinessCard({ label, icon: Icon, dependency, isLoading }) {
  const ready = dependency?.status === "ready";
  const unavailable = dependency?.status === "unavailable";
  return <div className={panel}><div className="flex items-start justify-between gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"><Icon className="h-5 w-5" /></span>{isLoading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-700" : unavailable ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{ready ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}{ready ? "Ready" : unavailable ? "Unavailable" : "Unknown"}</span>}</div><h2 className="mt-4 text-sm font-bold text-slate-900">{label}</h2><p className="mt-1 text-xs text-slate-500">{ready && dependency?.latencyMs != null ? `Live probe: ${dependency.latencyMs} ms` : unavailable ? "Live readiness probe failed or timed out." : "Waiting for a live readiness probe."}</p>{dependency?.checkedAt && <p className="mt-3 text-[11px] text-slate-400">Checked {formatTime(dependency.checkedAt)}</p>}</div>;
}

export default function AdminServerReportsPage() {
  const query = useAdminOperationsOverview();
  const overview = query.data;
  const api = overview?.api;
  const error = parseApiError(query.error).message || "Operational data is unavailable.";

  return <section className="mx-auto max-w-7xl space-y-5 pb-10">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="mb-1 flex items-center gap-2 text-xs text-slate-400"><span>Admin</span><span>/</span><span className="font-semibold text-slate-700">Server & Reports</span></div><h1 className="text-xl font-bold tracking-tight text-slate-900">Server & Reports</h1><p className="mt-1 text-xs text-slate-500">Live, process-local operational status. Dependency readiness is checked separately from API liveness.</p></div><button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${query.isFetching ? "animate-spin" : ""}`} />Refresh</button></div>

    {query.isError && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Monitoring endpoint unavailable</p><p className="mt-1 text-xs">{error}</p></div></div>}

    <div className="grid gap-4 md:grid-cols-3"><div className={panel}><div className="flex items-start justify-between"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Server className="h-5 w-5" /></span>{query.isLoading ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 className="h-3 w-3" />Alive</span>}</div><h2 className="mt-4 text-sm font-bold text-slate-900">Server Overview</h2><p className="mt-1 text-xs text-slate-500">Liveness confirms this API process responded.</p><p className="mt-3 text-2xl font-bold text-slate-900">{overview?.server ? formatUptime(overview.server.uptimeSeconds) : "—"}</p><p className="mt-1 text-[11px] text-slate-400">Current process uptime</p></div><ReadinessCard label="MySQL Database" icon={Database} dependency={overview?.dependencies?.mysql} isLoading={query.isLoading} /><ReadinessCard label="Redis Cache" icon={Activity} dependency={overview?.dependencies?.redis} isLoading={query.isLoading} /></div>

    <div className="grid gap-5 lg:grid-cols-2"><div className={panel}><div className="flex items-center gap-2"><Activity className="h-4 w-4 text-blue-600" /><h2 className="text-base font-bold text-slate-900">API Monitoring</h2></div><p className="mt-1 text-xs text-slate-400">Measured by this API process since its current start; not a historical or multi-instance report.</p><div className="mt-5 grid grid-cols-3 gap-3"><div><p className="text-[11px] font-semibold text-slate-500">Requests</p><p className="mt-1 text-xl font-bold text-slate-900">{api?.requestCount ?? "—"}</p></div><div><p className="text-[11px] font-semibold text-slate-500">Avg. latency</p><p className="mt-1 text-xl font-bold text-slate-900">{api?.averageLatencyMs == null ? "—" : `${api.averageLatencyMs} ms`}</p></div><div><p className="text-[11px] font-semibold text-slate-500">5xx error rate</p><p className="mt-1 text-xl font-bold text-slate-900">{api?.errorRatePercent == null ? "—" : `${api.errorRatePercent}%`}</p></div></div></div><div className={panel}><div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-blue-600" /><h2 className="text-base font-bold text-slate-900">Operational Reports</h2></div><p className="mt-1 text-xs text-slate-400">Live report generated at {formatTime(overview?.reports?.operational?.generatedAt)}.</p><div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600"><p className="font-semibold text-slate-800">Historical reports unavailable</p><p className="mt-1">{overview?.reports?.historical?.reason || "Persistent metrics storage has not been configured."}</p></div></div></div>

  </section>;
}
