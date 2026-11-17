import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, Plus, RefreshCw, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { fetchBackendDescendantRoles, fetchBackendUsers, createBackendUser } from "../../features/admin/services/adminApi";
import { AddAgentModal } from "../../features/admin/modals/AddAgentModal";

export default function UserTeam() {
  const [searchParams] = useSearchParams();
  const [roles, setRoles] = useState([]);
  const roleId = searchParams.get("roleId") || "";
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [rolesLoaded, setRolesLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [addModalOpen, setAddModalOpen] = useState(false);
  const previousRoleId = useRef(roleId);

  useEffect(() => {
    let mounted = true;
    fetchBackendDescendantRoles()
      .then((response) => {
        const permitted = Array.isArray(response?.data) ? response.data : [];
        if (!mounted) return;
        setRoles(permitted);
      })
      .catch((error) => {
        if (mounted) setLoadError(error?.response?.data?.message || "Could not load permitted user roles.");
      })
      .finally(() => {
        if (mounted) setRolesLoaded(true);
      });
    return () => { mounted = false; };
  }, []);

  const selectedRole = roles.find((role) => String(role.id) === String(roleId));

  const loadAgents = useCallback(async () => {
    if (!rolesLoaded) return;
    if (!roleId) {
      setUsers([]);
      setIsLoading(false);
      setLoadError("");
      return;
    }
    if (!selectedRole) {
      setUsers([]);
      setIsLoading(false);
      setLoadError("You are not authorized to view this role directory.");
      return;
    }
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetchBackendUsers({ roleId });
      setUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      setUsers([]);
      setLoadError(error?.response?.data?.message || "Could not load users for this role.");
    } finally {
      setIsLoading(false);
    }
  }, [roleId, rolesLoaded, selectedRole]);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  useEffect(() => {
    if (previousRoleId.current !== roleId) setAddModalOpen(false);
    previousRoleId.current = roleId;
  }, [roleId]);

  const filtered = useMemo(() => users.filter((user) => {
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [user.name, user.email, user.mobile, user.shopname, String(user.id)]
      .some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = statusFilter === "All" || (statusFilter === "Active" ? user.status === "active" : user.status !== "active");
    return matchesSearch && matchesStatus;
  }), [users, searchQuery, statusFilter]);

  const exportCsv = () => {
    if (!filtered.length) return toast.error("No users available to export");
    const headers = ["ID", "Name", "Email", "Mobile", "Role", "Shop", "City", "State", "Status"];
    const rows = filtered.map((user) => [user.id, user.name, user.email, user.mobile, user.role_name, user.shopname, user.city, user.state, user.status]
      .map((value) => `"${String(value || "").replace(/"/g, '""')}"`).join(","));
    const link = document.createElement("a");
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent([headers.join(","), ...rows].join("\n"))}`;
    link.download = `${selectedRole?.slug || "users"}-directory.csv`;
    link.click();
  };

  const handleCreate = async (agentData) => {
    try {
      const response = await createBackendUser({
        name: agentData.name.trim(), email: agentData.email.trim().toLowerCase(),
        mobile: agentData.mobile.trim(), role: selectedRole.slug, password: agentData.password,
        shopname: agentData.shopname?.trim() || null, city: agentData.city?.trim() || null,
        state: agentData.state?.trim() || null, address: agentData.address?.trim() || null,
        pincode: agentData.pincode ? String(agentData.pincode).trim() : null,
      });
      await loadAgents();
      window.dispatchEvent(new Event("aquapay:downline_updated"));
      toast.success("User created successfully.");
      return response?.data;
    } catch (error) {
      toast.error(error?.response?.data?.message || "Could not create this user.");
      return null;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{selectedRole ? `${selectedRole.name} Directory` : "User Directory"}</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{selectedRole ? `Users with the ${selectedRole.name} role in your authorized hierarchy` : "Select a permitted role from the sidebar to view its directory"}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {selectedRole && <span className="px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200/80 font-bold rounded-xl text-xs">{users.length} users</span>}
          <button onClick={loadAgents} disabled={isLoading || !selectedRole} className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs transition-colors shadow-2xs disabled:opacity-50">
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button onClick={() => setAddModalOpen(true)} disabled={!selectedRole} className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-lg text-xs transition-colors shadow-xs disabled:opacity-50">
            <Plus className="w-4 h-4" /> Create User
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input type="text" placeholder="Search by name, mobile, email, shop, or ID..." value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="flex items-center gap-2">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg px-3 py-2 font-medium focus:outline-none">
              <option value="All">All Status</option><option value="Active">Active Only</option><option value="Inactive">Inactive Only</option>
            </select>
            <button onClick={exportCsv} className="inline-flex items-center gap-1.5 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-semibold px-3 py-2 rounded-lg text-xs"><Download className="w-3.5 h-3.5" /> Export CSV</button>
          </div>
        </div>
        {loadError && <div role="alert" className="p-4 text-xs text-rose-700 bg-rose-50 border-b border-rose-100">{loadError}</div>}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead><tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4">Status</th><th className="py-3 px-4 min-w-[200px]">User</th><th className="py-3 px-4">Role</th><th className="py-3 px-4 min-w-[180px]">Contact</th><th className="py-3 px-4">Business & Address</th><th className="py-3 px-4 text-center">KYC</th><th className="py-3 px-4 text-center">Profile</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? <tr><td colSpan="7" className="text-center py-10 text-slate-400">Loading users…</td></tr>
                : !selectedRole ? <tr><td colSpan="7" className="text-center py-10 text-slate-400">Select a permitted role from the Roles section in the sidebar.</td></tr>
                : filtered.length === 0 ? <tr><td colSpan="7" className="text-center py-10 text-slate-400">No users found for {selectedRole?.name || "this role"}.</td></tr>
                : filtered.map((user) => <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="py-3.5 px-4"><span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">{user.status || "active"}</span></td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{user.name}<span className="block font-mono text-[10px] text-slate-400 font-normal">ID: #{user.id}</span></td>
                  <td className="py-3.5 px-4"><span className="bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded text-[11px]">{user.role_name || user.role_slug}</span></td>
                  <td className="py-3.5 px-4 text-slate-600">{user.mobile}<span className="block text-[11px] text-slate-400">{user.email}</span></td>
                  <td className="py-3.5 px-4 text-slate-600">{user.shopname || "—"}<span className="block text-[11px] text-slate-400">{[user.address, user.city, user.state].filter(Boolean).join(", ") || "Address not registered"}</span></td>
                  <td className="py-3.5 px-4 text-center"><span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">{user.kyc?.status || "pending"}</span></td>
                  <td className="py-3.5 px-4 text-center"><Link to={`/user/team/${user.id}?roleId=${encodeURIComponent(roleId)}`} className="inline-flex items-center gap-1.5 text-blue-700 hover:text-blue-900 font-semibold"><UserRound className="w-4 h-4" /> View</Link></td>
                </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      <AddAgentModal addAgentModalOpen={addModalOpen} setAddAgentModalOpen={setAddModalOpen} handleOnboardAgent={handleCreate} selectedRole={selectedRole?.slug || ""} />
    </div>
  );
}
