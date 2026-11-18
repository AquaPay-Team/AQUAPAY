import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  Eye,
  RefreshCw,
  Video,
  FileText,
  User,
  Building,
  Phone,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import { fetchUsersByKycStatus } from "../services/adminApi";

export function KycComplianceQueue({ onSelectUser }) {
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const statusTabs = [
    { id: "all", label: "All Cases" },
    { id: "submitted", label: "Submitted for Review", badgeColor: "bg-blue-100 text-blue-700" },
    { id: "under_review", label: "Under Review", badgeColor: "bg-amber-100 text-amber-700" },
    { id: "approved", label: "Approved / Verified", badgeColor: "bg-emerald-100 text-emerald-700" },
    { id: "rejected", label: "Rejected", badgeColor: "bg-rose-100 text-rose-700" },
    { id: "pending", label: "Incomplete / Pending", badgeColor: "bg-slate-100 text-slate-700" },
  ];

  const loadKycUsers = async () => {
    try {
      setIsLoading(true);
      const res = await fetchUsersByKycStatus(selectedStatus);
      if (res && res.data) {
        setUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      toast.error("Failed to load KYC verification records from backend");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadKycUsers();
  }, [selectedStatus]);

  const filteredUsers = users.filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.mobile && u.mobile.includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.shopname && u.shopname.toLowerCase().includes(q)) ||
      String(u.id).includes(q)
    );
  });

  const getStatusBadge = (status) => {
    const normalized = String(status || "pending").toLowerCase();
    switch (normalized) {
      case "approved":
      case "verified":
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Approved
          </span>
        );
      case "submitted":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3 text-blue-600" />
            Submitted
          </span>
        );
      case "under_review":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Under Review
          </span>
        );
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <XCircle className="w-3 h-3 text-rose-600" />
            Rejected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
            <AlertTriangle className="w-3 h-3 text-slate-400" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ── Page Header ───────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-400 flex items-center gap-2 mb-1">
            <span>Admin</span>
            <span>/</span>
            <span>Governance</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">KYC Compliance Queue</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-blue-600" />
            KYC Verification & Compliance Center
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit Aadhaar e-KYC, PAN tax records, Penny Drop bank accounts, and Live Video KYC submissions.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadKycUsers}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3.5 py-2 rounded-xl text-xs transition shadow-2xs cursor-pointer hover:shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            <span>Sync Live Records</span>
          </button>
        </div>
      </div>

      {/* ── Filter Tabs ───────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {statusTabs.map((tab) => {
          const isActive = selectedStatus === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-2 ${
                isActive
                  ? "bg-blue-600 text-white shadow-2xs"
                  : "bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/80"
              }`}
            >
              <span>{tab.label}</span>
              {tab.id === "submitted" && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                  Active
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Queue Panel Container ─────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden hover:shadow-sm transition-shadow">
        {/* Search & Actions Toolbar */}
        <div className="p-4 sm:p-5 bg-slate-50/40 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter by merchant name, phone, shop, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2.5 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{filteredUsers.length}</span>
            <span>cases matched filter</span>
          </div>
        </div>

        {/* Real Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/70 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-5 min-w-[200px]">Merchant / Agent</th>
                <th className="py-3 px-5 min-w-[180px]">Business & Shop</th>
                <th className="py-3 px-5 min-w-[160px]">Parent Agent</th>
                <th className="py-3 px-5 text-center min-w-[140px]">Step Progress</th>
                <th className="py-3 px-5 text-center w-32">Status</th>
                <th className="py-3 px-5 text-center w-28">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Fetching compliance cases from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-12 text-slate-400">
                    <div className="max-w-sm mx-auto space-y-1">
                      <p className="font-semibold text-slate-700 text-sm">No cases in this queue</p>
                      <p className="text-xs text-slate-400">
                        Select "All Cases" or change the filter tab to inspect other verification stages.
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((m) => {
                  const stepsDone = Number(m.kyc?.steps_completed || (m.kyc?.status === "completed" ? 7 : 1));
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Merchant */}
                      <td className="py-4 px-5 align-middle">
                        <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                          <span>{m.name}</span>
                          <span className="font-mono text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                            #{m.id}
                          </span>
                        </div>
                        <div className="text-slate-500 text-xs mt-0.5">
                          <span>{m.mobile}</span>
                          {m.email && <span className="text-slate-400"> • {m.email}</span>}
                        </div>
                        <span className="inline-block mt-1 bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-blue-100">
                          {m.role_name || m.role_slug || "Retailer"}
                        </span>
                      </td>

                      {/* Business & Shop */}
                      <td className="py-4 px-5 align-middle">
                        <div className="font-semibold text-slate-800">
                          {m.shopname || "Direct Merchant"}
                        </div>
                        <div className="text-slate-400 text-xs mt-0.5">
                          {[m.city, m.state, m.pincode].filter(Boolean).join(", ") || "Location pending"}
                        </div>
                      </td>

                      {/* Parent */}
                      <td className="py-4 px-5 align-middle">
                        <div className="font-medium text-slate-800">{m.parent_name || "System Admin"}</div>
                        {m.company_name && (
                          <div className="text-slate-400 text-[11px] mt-0.5 truncate max-w-[150px]">
                            {m.company_name}
                          </div>
                        )}
                      </td>

                      {/* Step Progress */}
                      <td className="py-4 px-5 text-center align-middle">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[11px] font-bold text-slate-700">
                            {stepsDone} / 7 Steps
                          </span>
                          <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                            <div
                              className="h-full bg-blue-600 rounded-full transition-all"
                              style={{ width: `${Math.round((stepsDone / 7) * 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 text-center align-middle">
                        {getStatusBadge(m.kyc?.status)}
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-center align-middle">
                        <button
                          type="button"
                          onClick={() => onSelectUser && onSelectUser(m)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-300 text-slate-700 hover:text-blue-700 rounded-xl font-semibold text-xs transition cursor-pointer shadow-2xs hover:shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Review</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default KycComplianceQueue;