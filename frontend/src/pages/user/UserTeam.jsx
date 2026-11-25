import React, { useState, useMemo } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/useAuth";
import { AdminUserTable } from "@/features/admin/components/AdminUserTable";
import { AddAgentModal } from "@/features/users/components/AddAgentModal";
import {
  useUsers,
  useDescendantRoles,
  useCreateUser,
} from "@/features/admin/hooks/useAdminUsers";

const EMPTY_USERS = [];

export default function UserTeam() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const selectedRoleId = searchParams.get("roleId") || "";

  // Pagination state (UI page displays 25 users, backend fetches in batches of 100)
  const UI_PAGE_SIZE = 25;
  const [uiPage, setUiPage] = useState(1);
  const backendBatch = Math.max(1, Math.ceil(uiPage / 4));

  // Local filtering state
  const [memberSearch, setMemberSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");

  // Modals state
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

  // TanStack Query hooks for server-side batched users & roles
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({
    roleId: selectedRoleId,
    page: backendBatch,
    limit: 100,
    search: memberSearch.trim(),
    status: accountFilter === "All" ? "" : accountFilter.toLowerCase(),
    kycStatus: kycFilter === "All" ? "" : kycFilter.toLowerCase(),
  });

  const { data: permittedRoles = [] } = useDescendantRoles();
  const createUserMutation = useCreateUser();

  const users = usersData?.users || EMPTY_USERS;
  const pagination = usersData?.pagination || {
    total: users.length,
    page: backendBatch,
    limit: 100,
    totalPages: 1,
  };

  const selectedRole = permittedRoles.find(
    (role) => String(role.id) === String(selectedRoleId)
  );

  const getCurrentRoleTitle = () => {
    if (selectedRoleId) {
      return selectedRole?.name || "Member";
    }
    return "All Users";
  };

  const hasActiveFilters = Boolean(
    memberSearch.trim() ||
    kycFilter !== "All" ||
    accountFilter !== "All"
  );

  const handleSearchChange = (val) => {
    setMemberSearch(val);
    setUiPage(1);
  };

  const handleKycFilterChange = (val) => {
    setKycFilter(val);
    setUiPage(1);
  };

  const handleAccountFilterChange = (val) => {
    setAccountFilter(val);
    setUiPage(1);
  };

  const resetAllFilters = () => {
    setMemberSearch("");
    setKycFilter("All");
    setAccountFilter("All");
    setUiPage(1);
  };

  // Slices 25 users per UI page from the 100-user batch loaded in memory
  const visibleMembers = useMemo(() => {
    const sliceStart = ((uiPage - 1) % 4) * UI_PAGE_SIZE;
    return users.slice(sliceStart, sliceStart + UI_PAGE_SIZE);
  }, [users, uiPage]);

  const totalUsers = pagination.total || 0;
  const totalUiPages = Math.max(1, Math.ceil(totalUsers / UI_PAGE_SIZE));

  // Export users to CSV
  const handleExportCSV = (filename, dataRows) => {
    if (!dataRows || !dataRows.length) {
      toast.error("No user data available to export");
      return;
    }
    const keys = ["id", "name", "email", "mobile", "role_name", "shopname", "city", "state", "status"];
    const headers = ["ID", "Name", "Email", "Mobile", "Role", "Shop Name", "City", "State", "Status"];

    const rows = dataRows.map((u) =>
      keys.map((k) => `"${String(u[k] || "").replace(/"/g, '""')}"`).join(",")
    );

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filename}.csv with ${dataRows.length} records`);
  };

  const handleOnboardAgent = async (agentData) => {
    try {
      const targetRoleSlug = agentData.role || selectedRole?.slug || permittedRoles[0]?.slug;
      if (!targetRoleSlug) {
        toast.error("No permitted role available for onboarding");
        return null;
      }
      const payload = {
        name: agentData.name.trim(),
        email: agentData.email.trim().toLowerCase(),
        mobile: agentData.mobile.trim(),
        role: targetRoleSlug,
        password: agentData.password,
        shopname: agentData.shopname?.trim() || null,
        city: agentData.city?.trim() || null,
        state: agentData.state?.trim() || null,
        address: agentData.address?.trim() || null,
        pincode: agentData.pincode ? String(agentData.pincode).trim() : null,
      };

      const res = await createUserMutation.mutateAsync(payload);
      toast.success("User created successfully.");
      return res?.data;
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to onboard agent";
      toast.error(errMsg);
      return null;
    }
  };

  // Retailer has no children / downline agents, redirect to dashboard
  if (user?.role_slug === "RT" || Number(user?.role_id) === 8) {
    return <Navigate to="/user/dashboard" replace />;
  }

  return (
    <>
      <AdminUserTable
        scope="user"
        basePath="/user/team"
        canCreateUser={permittedRoles.length > 0}
        getCurrentRoleTitle={getCurrentRoleTitle}
        memberSearch={memberSearch}
        setMemberSearch={handleSearchChange}
        kycFilter={kycFilter}
        setKycFilter={handleKycFilterChange}
        accountFilter={accountFilter}
        setAccountFilter={handleAccountFilterChange}
        hasActiveFilters={hasActiveFilters}
        resetAllFilters={resetAllFilters}
        filteredMembers={users}
        visibleMembers={visibleMembers}
        uiPage={uiPage}
        setUiPage={setUiPage}
        totalUsers={totalUsers}
        totalUiPages={totalUiPages}
        pageSize={UI_PAGE_SIZE}
        handleExportCSV={handleExportCSV}
        setAddAgentModalOpen={setAddAgentModalOpen}
        isLoadingUsers={isLoadingUsers}
        selectedRoleId={selectedRoleId}
        onToggleStatus={null}
        updatingUserId={null}
      />

      <AddAgentModal
        addAgentModalOpen={addAgentModalOpen}
        setAddAgentModalOpen={setAddAgentModalOpen}
        handleOnboardAgent={handleOnboardAgent}
        selectedRole={selectedRole?.slug || ""}
        permittedRoles={permittedRoles}
      />
    </>
  );
}
