import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Search,
  Download,
  Plus,
  RefreshCw,
  Building,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { getRoleMeta } from "../../constants/roles";
import { fetchBackendUsers, createBackendUser } from "../../features/admin/services/adminApi";
import { AddAgentModal } from "../../features/admin/modals/AddAgentModal";

export default function UserTeam() {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleId = Number(currentUser.role_id) || 8;
  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Partner",
    slug: "RT",
  };

  const canManageAgents = roleId >= 2 && roleId <= 7;

  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(canManageAgents);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addModalOpen, setAddModalOpen] = useState(false);

  const loadAgents = useCallback(async () => {
    if (!canManageAgents) return;
    try {
      setIsLoading(true);
      const res = await fetchBackendUsers();
      if (res && res.data) {
        setUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.warn("Failed to load downline users:", err?.message);
      toast.error("Could not sync downline users with database");
    } finally {
      setIsLoading(false);
    }
  }, [canManageAgents]);

  useEffect(() => {
    if (canManageAgents) {
      loadAgents();
    }

    const handleUpdate = () => loadAgents();
    window.addEventListener("aquapay:downline_updated", handleUpdate);
    return () => window.removeEventListener("aquapay:downline_updated", handleUpdate);
  }, [canManageAgents, loadAgents]);

  const handleOnboardAgent = async (agentData) => {
    try {
      const payload = {
        name: agentData.name.trim(),
        email: agentData.email.trim().toLowerCase(),
        mobile: agentData.mobile.trim(),
        role: agentData.role,
        password: agentData.password || "Welcome@123",
        shopname: agentData.shopname?.trim() || null,
        city: agentData.city?.trim() || null,
        state: agentData.state?.trim() || null,
        address: agentData.address?.trim() || null,
        pincode: agentData.pincode ? String(agentData.pincode).trim() : null,
      };

      const res = await createBackendUser(payload);
      if (res && res.data) {
        setUsers((prev) => [res.data, ...prev]);
        toast.success(`Agent ${res.data.name} onboarded successfully!`);
        setAddModalOpen(false);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || "Failed to onboard agent";
      toast.error(errMsg);
    }
  };

  const filtered = useMemo(() => {
    return users.filter((u) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.shopname && u.shopname.toLowerCase().includes(q)) ||
        String(u.id).includes(q);

      const matchStatus =
        statusFilter === "All"
          ? true
          : statusFilter === "Active"
          ? u.status === "active"
          : u.status !== "active";

      return matchSearch && matchStatus;
    });
  }, [users, searchQuery, statusFilter]);

  const handleExportCSV = () => {
    if (!filtered.length) {
      toast.error("No downline data available to export");
      return;
    }
    const headers = ["ID", "Name", "Email", "Mobile", "Role", "Shop Name", "City", "State", "Status"];
    const rows = filtered.map((u) => [
      u.id,
      `"${u.name || ""}"`,
      `"${u.email || ""}"`,
      `"${u.mobile || ""}"`,
      `"${u.role_name || ""}"`,
      `"${u.shopname || ""}"`,
      `"${u.city || ""}"`,
      `"${u.state || ""}"`,
      `"${u.status || "active"}"`,
    ].join(","));

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${roleMeta.slug}_Downline_Network.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Downline network exported to CSV");
  };

  if (!canManageAgents) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-8 border border-slate-200 shadow-2xs text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
          <Building className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">Retailer Terminal Account</h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
          As an authorized AquaPay Retailer, your terminal is dedicated to executing consumer banking services (AEPS, BBPS, DMT, Recharges). Child agent management is reserved for Channel Distributors and Managers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            My Downline Network
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Manage agents onboarded under your {roleMeta.name} hierarchy
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAgents}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-blue-600" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Add Downline Agent
          </button>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by agent name, mobile, email, shop, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none"
            >
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </button>
          </div>
        </div>

        {/* Database Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <th className="py-3 px-4 w-20 text-center">STATUS</th>
                <th className="py-3 px-4 min-w-[200px]">AGENT DETAILS</th>
                <th className="py-3 px-4 min-w-[140px]">ROLE</th>
                <th className="py-3 px-4 min-w-[180px]">CONTACT</th>
                <th className="py-3 px-4 min-w-[180px]">SHOP & LOCATION</th>
                <th className="py-3 px-4 text-center">KYC STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading network members from database...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-10 text-slate-400">
                    <p className="font-semibold text-slate-600 text-xs">No downline agents found</p>
                    <p className="text-[11px] text-slate-400 mt-1 max-w-sm mx-auto">
                      Click "Add Downline Agent" to onboard your first child agent under your {roleMeta.name} network.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800">
                        {m.status || "Active"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      <div>{m.name}</div>
                      <span className="font-mono text-[10px] text-slate-400 font-normal">
                        ID: #{m.id}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[11px]">
                        {m.role_name || "Agent"}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{m.mobile}</div>
                      <div className="text-[11px] text-slate-400">{m.email}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="font-medium text-slate-800">{m.shopname || "AquaPay Retail Outlet"}</div>
                      <div className="text-[11px] text-slate-400">{m.city || ""}, {m.state || ""}</div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">
                        {m.kyc?.status || "Pending"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Agent Modal */}
      <AddAgentModal
        addAgentModalOpen={addModalOpen}
        setAddAgentModalOpen={setAddModalOpen}
        handleOnboardAgent={handleOnboardAgent}
      />
    </div>
  );
}
