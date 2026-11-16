import React from "react";
import {
  Users,
  UserCheck,
  ShieldCheck,
  Building,
  Plus,
  ArrowRight,
  ArrowUpRight,
  Server,
  Database,
  RefreshCw,
  MoreHorizontal,
  UserPlus,
  FileText,
  Calendar,
  BarChart2,
  BarChart3,
  TrendingUp,
  Cpu,
  Layers,
  Settings,
  CheckCircle2,
} from "lucide-react";

export function DashboardOverview({
  stats = { total: 0, active: 0, retailers: 0, verifiedKyc: 0, pendingKyc: 0 },
  setActiveTab = () => {},
  setAddAgentModalOpen = () => {},
  loadUsers = () => {},
  isLoadingUsers = false,
}) {
  const currentUser = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("adminUser") ||
          localStorage.getItem("user") ||
          "{}"
      );
    } catch {
      return {};
    }
  })();

  const roleId = Number(currentUser.role_id) || 1;
  const isSuperAdmin = roleId === 1;
  const canManageAgents = roleId >= 1 && roleId <= 7;

  return (
    <div className="space-y-7 max-w-7xl mx-auto pb-10">
      {/* ── Dashboard Page Header ─────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {isSuperAdmin
              ? "Dashboard Overview"
              : roleId === 8
              ? "Merchant Terminal Overview"
              : `${currentUser.role_name || "Agent"} Network Overview`}
          </h1>
          <p className="text-slate-500 text-xs sm:text-xs mt-0.5">
            {isSuperAdmin
              ? "Real-time identity, merchant onboarding, and governance metrics"
              : roleId === 8
              ? "Live operational terminal and verified business account details"
              : "Real-time downline agent network and onboarding metrics"}
          </p>
        </div>

        {canManageAgents && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={loadUsers}
              disabled={isLoadingUsers}
              className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition border border-slate-200 shadow-2xs flex items-center gap-2 cursor-pointer hover:shadow-sm disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-black ${
                  isLoadingUsers ? "animate-spin text-blue-600" : ""
                }`}
              />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => setAddAgentModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded-xl transition shadow-2xs flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.25} />
              <span>Onboard Agent</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Empty Downline Network Callout ────────────────────────── */}
      {!isSuperAdmin && canManageAgents && stats.total === 0 && (
        <div className="bg-white border border-blue-200/90 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:shadow-sm transition-shadow">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <span className="font-bold text-slate-800 text-sm block">
                Welcome to your {currentUser.role_name || "Channel"} Console
              </span>
              <span className="text-slate-500 text-xs">
                Your portal monitors and manages agents onboarded under your hierarchy. Click below to add your first downline agent.
              </span>
            </div>
          </div>
          <button
            onClick={() => setAddAgentModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-5 py-2.5 rounded-xl transition shadow-2xs shrink-0 text-center cursor-pointer"
          >
            Onboard First Agent
          </button>
        </div>
      )}

      {/* ── Top Metric Cards with Watermark Icons (User Dashboard Style) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Card 1: Total Registered Users */}
        <div className="relative overflow-hidden bg-blue-50/60 rounded-2xl p-6 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <Users
            className="absolute -right-3 -bottom-3 w-24 h-24 text-blue-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
            strokeWidth={1}
          />
          <span className="text-xs font-semibold text-slate-500 block">
            {isSuperAdmin ? "Total Users" : "My Network"}
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {stats.total}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              100%
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            {isSuperAdmin ? (
              <>
                Registered in <span className="text-blue-500 font-medium">Database</span>
              </>
            ) : (
              <>
                Child agents in <span className="text-blue-500 font-medium">network</span>
              </>
            )}
          </p>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="relative overflow-hidden bg-emerald-50/60 rounded-2xl p-6 border border-emerald-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <UserCheck
            className="absolute -right-3 -bottom-3 w-24 h-24 text-emerald-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
            strokeWidth={1}
          />
          <span className="text-xs font-semibold text-slate-500 block">
            Active Accounts
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {stats.active}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-emerald-100 text-emerald-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              Active
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Operational <span className="text-emerald-500 font-medium">Status Verified</span>
          </p>
        </div>

        {/* Card 3: Retailers Network */}
        <div className="relative overflow-hidden bg-purple-50/60 rounded-2xl p-6 border border-purple-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <Building
            className="absolute -right-3 -bottom-3 w-24 h-24 text-purple-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
            strokeWidth={1}
          />
          <span className="text-xs font-semibold text-slate-500 block">
            Retailers Network
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {stats.retailers}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              Counter
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Active retail <span className="text-purple-500 font-medium">merchant outlets</span>
          </p>
        </div>

        {/* Card 4: KYC Completed */}
        <div className="relative overflow-hidden bg-amber-50/60 rounded-2xl p-6 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
          <ShieldCheck
            className="absolute -right-3 -bottom-3 w-24 h-24 text-amber-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
            strokeWidth={1}
          />
          <span className="text-xs font-semibold text-slate-500 block">
            KYC Completed
          </span>
          <div className="flex items-center gap-3 mt-3">
            <span className="text-3xl font-bold text-slate-900 tracking-tight">
              {stats.verifiedKyc}
            </span>
            <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-600">
              <ArrowUpRight className="w-3 h-3 text-black" />
              {stats.pendingKyc} Pending
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-3">
            Compliance <span className="text-amber-500 font-medium">audit pass rate</span>
          </p>
        </div>
      </div>

      {/* ── Admin Services & Operations (Exact User Dashboard Grid Style) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">Admin Operations & Services</h2>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
            title="Service options"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Op 1: Onboard New Agent */}
          <div
            onClick={() => setAddAgentModalOpen(true)}
            className="bg-blue-50/50 border border-blue-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Onboard Agent</h3>
              <p className="text-xs text-slate-400 mt-1.5">Instant Registration</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-blue-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserPlus className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Op 2: User Directory */}
          <div
            onClick={() => setActiveTab("all-users")}
            className="bg-emerald-50/50 border border-emerald-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">User Directory</h3>
              <p className="text-xs text-slate-400 mt-1.5">Hierarchy & Accounts</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-emerald-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Op 3: KYC Verification Queue */}
          <div
            onClick={() => setActiveTab("kyc")}
            className="bg-amber-50/50 border border-amber-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">KYC Verification</h3>
              <p className="text-xs text-slate-400 mt-1.5">UIDAI & Compliance Queue</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-amber-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <ShieldCheck className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>

          {/* Op 4: Audit & Reports */}
          <div
            onClick={() => setActiveTab("reports")}
            className="bg-purple-50/50 border border-purple-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
          >
            <div>
              <h3 className="text-base font-bold text-slate-900">Audit Reports</h3>
              <p className="text-xs text-slate-400 mt-1.5">Ledger & System Logs</p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-purple-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
              <FileText className="w-6 h-6 text-black" strokeWidth={2} />
            </div>
          </div>
        </div>
      </div>

      {/* ── System & Network Performance (Bar Chart Visuals matching User Dashboard) ── */}
      <div className="space-y-4">
        <h2 className="text-base font-bold text-slate-900">System & Network Overview</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Today Operations */}
          <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Today Network</h4>
                <p className="text-[11px] text-slate-400">Live API Requests</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[20, 35, 15, 45, 30, 50, 10].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 6 ? "#10b981" : "#d1fae5",
                  }}
                />
              ))}
            </div>
            <span className="text-xl font-bold text-emerald-600">Active</span>
          </div>

          {/* This Month Growth */}
          <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <BarChart2 className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">This Month</h4>
                <p className="text-[11px] text-slate-400">Agent Network Growth</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[30, 55, 40, 60, 45].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 4 ? "#3b82f6" : "#dbeafe",
                  }}
                />
              ))}
            </div>
            <span className="text-xl font-bold text-blue-600">+{stats.total} Agents</span>
          </div>

          {/* Last Month Activity */}
          <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">Compliance Audits</h4>
                <p className="text-[11px] text-slate-400">KYC Verification Rate</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[45, 35, 60, 50, 40].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 2 ? "#f59e0b" : "#fef3c7",
                  }}
                />
              ))}
            </div>
            <span className="text-xl font-bold text-amber-600">{stats.verifiedKyc} Verified</span>
          </div>

          {/* System Performance */}
          <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800">System Uptime</h4>
                <p className="text-[11px] text-slate-400">Backend Availability</p>
              </div>
            </div>
            <div className="flex items-end gap-1 h-11 mb-3">
              {[25, 40, 55, 70].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t transition-all"
                  style={{
                    height: `${h}%`,
                    backgroundColor: i === 3 ? "#f43f5e" : "#fecdd3",
                  }}
                />
              ))}
            </div>
            <span className="text-xl font-bold text-rose-600">99.98%</span>
          </div>
        </div>
      </div>

      {/* ── Backend Infrastructure & Server Status Card (User Dashboard Style) ── */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs p-6 hover:shadow-sm transition-shadow">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Server className="w-5 h-5 text-black" strokeWidth={2} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Backend Services & Database Sync
                </h3>
                <p className="text-xs text-slate-400">
                  Real-time connectivity with MySQL cluster and authentication gateway
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              All Services Operational
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">AquaPay Express API</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Port 3000 • Operational</p>
                <span className="inline-block mt-2 text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-lg">
                  Health: OK
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">Aiven Cloud MySQL</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Table `users` synced</p>
                <span className="inline-block mt-2 text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-lg">
                  {stats.total} Records Active
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50/70 rounded-xl border border-slate-200/70 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
              <div>
                <p className="text-xs font-bold text-slate-900">Redis Cache & Sessions</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Rate limiting & token store</p>
                <span className="inline-block mt-2 text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-lg">
                  PONG Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick Directory Access Card ───────────────────────────── */}
      {canManageAgents && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:shadow-sm transition-shadow">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isSuperAdmin
                ? "View & Manage All Users in Database"
                : "View My Downline Agents"}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {isSuperAdmin
                ? "Filter users by role, search by mobile or email, and update agent configurations."
                : "Manage and inspect your onboarded agents across your network."}
            </p>
          </div>
          <button
            onClick={() => setActiveTab("all-users")}
            className="inline-flex items-center gap-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition shadow-2xs cursor-pointer shrink-0 hover:shadow-sm"
          >
            <span>{isSuperAdmin ? "Open User Directory" : "Open My Network"}</span>
            <ArrowRight className="w-3.5 h-3.5 text-black" />
          </button>
        </div>
      )}
    </div>
  );
}

export default DashboardOverview;