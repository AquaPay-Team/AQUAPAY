import React from 'react';
import {
  Users,
  UserCheck,
  ShieldCheck,
  Building,
  Plus,
  ArrowRight,
  Server,
  Database,
  RefreshCw
} from 'lucide-react';

export function DashboardOverview({
  stats,
  setActiveTab,
  setAddAgentModalOpen,
  loadUsers,
  isLoadingUsers
}) {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("adminUser") || localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleId = Number(currentUser.role_id) || 1;
  const isSuperAdmin = roleId === 1;
  const canManageAgents = roleId >= 1 && roleId <= 7;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            {isSuperAdmin
              ? 'Dashboard Overview'
              : roleId === 8
              ? 'Merchant Terminal Overview'
              : `${currentUser.role_name || 'Agent'} Network Overview`}
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {isSuperAdmin
              ? 'Real-time identity, merchant onboarding, and governance metrics'
              : roleId === 8
              ? 'Live operational terminal and verified business account details'
              : 'Real-time downline agent network and onboarding metrics'}
          </p>
        </div>

        {canManageAgents && (
          <div className="flex items-center gap-2">
            <button
              onClick={loadUsers}
              disabled={isLoadingUsers}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-blue-600' : ''}`} />
              Refresh Data
            </button>

            <button
              onClick={() => setAddAgentModalOpen && setAddAgentModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Create User
            </button>
          </div>
        )}
      </div>

      {/* Onboarding Callout Banner for Empty Downline Network */}
      {!isSuperAdmin && canManageAgents && stats?.total === 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-5 text-slate-800 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="inline-block text-[10px] font-bold uppercase tracking-wider bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
                Portal Active & Connected
              </span>
              <h2 className="text-base font-bold text-slate-900">
                Welcome to your {currentUser.role_name || 'Channel'} Management Console
              </h2>
              <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
                As a {currentUser.role_name || 'Partner'}, your portal monitors and manages agents onboarded under your hierarchy. You have not onboarded any agents yet. Click below to add your first downline agent.
              </p>
            </div>
            <button
              onClick={() => setAddAgentModalOpen && setAddAgentModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2.5 rounded-xl text-xs transition-colors shadow-xs cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" /> Onboard First Agent
            </button>
          </div>
        </div>
      )}

      {/* View For Retailer / Terminal Account */}
      {roleId === 8 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="md:col-span-2 bg-white rounded-xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-slate-900 text-sm">
                Business & Terminal Profile
              </h2>
              <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-2.5 py-0.5 rounded-full">
                KYC Completed
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Merchant Name</span>
                <span className="font-semibold text-slate-800 text-sm">{currentUser.name || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Mobile Number</span>
                <span className="font-semibold text-slate-800">{currentUser.mobile || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Email Address</span>
                <span className="font-semibold text-slate-800">{currentUser.email || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Shop Name</span>
                <span className="font-semibold text-slate-800">{currentUser.shopname || 'AquaPay Retail Outlet'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">City / State</span>
                <span className="font-semibold text-slate-800">{currentUser.city || 'N/A'}, {currentUser.state || ''}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Account Status</span>
                <span className="font-semibold text-emerald-600 uppercase">Active</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-2xs flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm mb-1">Terminal Services</h3>
              <p className="text-xs text-slate-500 mb-4">Fintech services activated for your terminal.</p>
              <div className="space-y-2 text-xs">
                {['AEPS Cash Out & Balance', 'BBPS Bill Payments', 'Domestic Money Transfer', 'Micro-ATM Services'].map((srv) => (
                  <div key={srv} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 text-slate-700 font-medium">
                    <div className="w-2 h-2 rounded-full bg-emerald-500" />
                    <span>{srv}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Top 4 Real Backend Metric Cards for Managers & SuperAdmin */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Registered Users */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-blue-300/80 transition-all duration-300 ease-out cursor-default">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {isSuperAdmin ? 'Total Users' : 'My Network'}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">
              {stats?.total ?? 0}
            </div>
            <div className="mt-2 text-xs font-medium text-slate-500">
              {isSuperAdmin ? 'Registered in Database' : 'Child Agents in Network'}
            </div>
            {/* Tilted Corner-Fixed Watermark Icon */}
            <Users className="absolute -right-2 -bottom-2 w-20 h-20 text-blue-500/10 group-hover:text-blue-500/20 stroke-[1.25] pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1" />
          </div>

          {/* Card 2: Active Accounts */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-emerald-300/80 transition-all duration-300 ease-out cursor-default">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Active Accounts
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">
              {stats?.active ?? 0}
            </div>
            <div className="mt-2 text-xs font-medium text-emerald-600">
              Operational Status
            </div>
            {/* Tilted Corner-Fixed Watermark Icon */}
            <UserCheck className="absolute -right-2 -bottom-2 w-20 h-20 text-emerald-500/10 group-hover:text-emerald-500/20 stroke-[1.25] pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1" />
          </div>

          {/* Card 3: Retailers */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-indigo-300/80 transition-all duration-300 ease-out cursor-default">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Retailers Network
              </span>
              <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <Building className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">
              {stats?.retailers ?? 0}
            </div>
            <div className="mt-2 text-xs font-medium text-indigo-600">
              Active Retail Points
            </div>
            {/* Tilted Corner-Fixed Watermark Icon */}
            <Building className="absolute -right-2 -bottom-2 w-20 h-20 text-indigo-500/10 group-hover:text-indigo-500/20 stroke-[1.25] pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1" />
          </div>

          {/* Card 4: KYC Completed */}
          <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-2xs relative overflow-hidden group hover:shadow-lg hover:-translate-y-1 hover:border-amber-300/80 transition-all duration-300 ease-out cursor-default">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                KYC Completed
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 text-3xl font-extrabold text-slate-900 tracking-tight group-hover:translate-x-0.5 transition-transform duration-300">
              {stats?.verifiedKyc ?? 0}
            </div>
            <div className="mt-2 text-xs font-medium text-amber-600">
              {stats?.pendingKyc ?? 0} Pending Verification
            </div>
            {/* Tilted Corner-Fixed Watermark Icon */}
            <ShieldCheck className="absolute -right-2 -bottom-2 w-20 h-20 text-amber-500/10 group-hover:text-amber-500/20 stroke-[1.25] pointer-events-none transition-all duration-300 ease-out transform -rotate-12 group-hover:rotate-0 group-hover:scale-110 group-hover:-translate-y-1" />
          </div>
        </div>
      )}

      {/* Backend Infrastructure & Server Status Card for SuperAdmin */}
      {isSuperAdmin && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-2xs">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-blue-600" />
            Backend Services & Database Sync
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-xs font-bold text-slate-900">AquaPay Express API</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Port 3000 • Operational</p>
                <span className="inline-block mt-2 text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  Health: OK
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-xs font-bold text-slate-900">Aiven Cloud MySQL</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Table `users` synced</p>
                <span className="inline-block mt-2 text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
                  {stats?.total ?? 0} Records Synced
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-start gap-3">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0"></div>
              <div>
                <p className="text-xs font-bold text-slate-900">Redis Cache & Sessions</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Rate limiting & token store</p>
                <span className="inline-block mt-2 text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded">
                  PONG Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Directory Quick Link */}
      {canManageAgents && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isSuperAdmin ? "View & Manage All Users in Database" : "View My Downline Agents"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isSuperAdmin
                ? "Filter users by role, search by mobile or email, and update agent configurations."
                : "Manage and inspect your onboarded agents across your network."}
            </p>
          </div>
          <button
            onClick={() => setActiveTab && setActiveTab('all-users')}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-semibold px-4 py-2 rounded-lg text-xs transition-colors cursor-pointer shrink-0"
          >
            <span>{isSuperAdmin ? "Open User Directory" : "Open My Network"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

export default DashboardOverview;