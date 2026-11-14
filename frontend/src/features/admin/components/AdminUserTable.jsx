import React from 'react';
import {
  Search,
  Download,
  Plus,
  Settings,
  ShieldCheck,
  Building,
  User,
  Phone,
  Mail,
  MapPin
} from 'lucide-react';

export function AdminUserTable({
  getCurrentRoleTitle,
  memberSearch,
  setMemberSearch,
  statusFilter,
  setStatusFilter,
  filteredMembers,
  handleExportCSV,
  setAddAgentModalOpen,
  setActionModalUser,
  isLoadingUsers
}) {
  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Breadcrumbs */}
      <div className="text-xs text-slate-500 flex items-center gap-2">
        <span>Admin</span>
        <span>/</span>
        <span>Directory</span>
        <span>/</span>
        <span className="font-bold text-slate-800 capitalize">
          {getCurrentRoleTitle()}
        </span>
      </div>

      {/* White Table Panel Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Control Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by Name, Mobile, Email, Shop, or ID..."
              value={memberSearch}
              onChange={(e) => setMemberSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* Controls Right */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none focus:border-blue-500"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            <button
              onClick={() => handleExportCSV(`${getCurrentRoleTitle()}_List`, filteredMembers)}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
            </button>

            <button
              onClick={() => setAddAgentModalOpen(true)}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Add New Agent
            </button>
          </div>
        </div>

        {/* REAL DATABASE TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-20 text-center">STATUS</th>
                <th className="py-3 px-4 min-w-[200px]">USER DETAILS</th>
                <th className="py-3 px-4 min-w-[180px]">SHOP & LOCATION</th>
                <th className="py-3 px-4 min-w-[160px]">PARENT AGENT</th>
                <th className="py-3 px-4 w-32 text-center">KYC STATUS</th>
                <th className="py-3 px-4 w-24 text-center">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading real users from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <div className="max-w-md mx-auto space-y-1">
                      <p className="font-semibold text-slate-600 text-xs">No {getCurrentRoleTitle()} agents found</p>
                      <p className="text-[11px] text-slate-400">
                        Accounts show agents created within their hierarchy. Click "Add New Agent" to onboard an agent.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredMembers.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    {/* Status Badge */}
                    <td className="py-4 px-4 text-center align-middle">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          m.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {m.status || 'Active'}
                      </span>
                    </td>

                    {/* User Details */}
                    <td className="py-4 px-4 align-middle">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                        {m.name}
                        <span className="font-mono text-[10px] font-normal text-slate-400">
                          #{m.id}
                        </span>
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5 flex items-center gap-2">
                        <span>{m.mobile}</span>
                        {m.email && <span className="text-slate-400">• {m.email}</span>}
                      </div>
                      <span className="inline-block bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded mt-1">
                        {m.role_name || m.role_slug || 'Retailer'}
                      </span>
                    </td>

                    {/* Shop & Location */}
                    <td className="py-4 px-4 align-middle">
                      <div className="font-semibold text-slate-800">
                        {m.shopname || '—'}
                      </div>
                      <div className="text-slate-500 text-xs mt-0.5">
                        {[m.city, m.state, m.pincode].filter(Boolean).join(', ') || 'Address not registered'}
                      </div>
                    </td>

                    {/* Parent Details */}
                    <td className="py-4 px-4 align-middle">
                      <div className="font-medium text-slate-800">
                        {m.parent_name || 'System Admin'}
                      </div>
                      {m.company_name && (
                        <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-[180px]">
                          {m.company_name}
                        </div>
                      )}
                    </td>

                    {/* KYC Status */}
                    <td className="py-4 px-4 text-center align-middle">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-semibold capitalize ${
                          m.kyc?.status === 'verified' || m.kyc?.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : m.kyc?.status === 'submitted'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}
                      >
                        {m.kyc?.status || 'Pending'}
                      </span>
                    </td>

                    {/* Action Button */}
                    <td className="py-4 px-4 text-center align-middle">
                      <button
                        onClick={() => setActionModalUser(m)}
                        className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-slate-200 inline-flex items-center justify-center cursor-pointer"
                        title="Edit Agent Details"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminUserTable;
