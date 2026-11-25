import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminUserTable } from "../components/AdminUserTable";
import { AddAgentModal } from "@/features/users/components/AddAgentModal";
import {
  useUsers,
  useDescendantRoles,
  useCreateUser,
  useUpdateUser,
} from "../hooks/useAdminUsers";

const EMPTY_USERS = [];

export default function AdminUsersPage() {
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

  // Data fetching via TanStack Query with server-side pagination & filters
  const { data: usersData, isLoading: isLoadingUsers } = useUsers({
    roleId: selectedRoleId,
    page: backendBatch,
    limit: 100,
    search: memberSearch.trim(),
    status: accountFilter === "All" ? "" : accountFilter.toLowerCase(),
    kycStatus: kycFilter === "All" ? "" : kycFilter.toLowerCase(),
  });

  const users = usersData?.users || EMPTY_USERS;
  const pagination = usersData?.pagination || {
    total: users.length,
    page: backendBatch,
    limit: 100,
    totalPages: 1,
  };

  const { data: permittedRoles = [] } = useDescendantRoles();

  // Modals state
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);

  // Mutations
  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const selectedRole = permittedRoles.find(
    (role) => String(role.id) === String(selectedRoleId)
  );

  const getCurrentRoleTitle = () => {
    if (selectedRoleId) {
      return selectedRole?.name || "User";
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
      const payload = {
        name: agentData.name.trim(),
        email: agentData.email.trim().toLowerCase(),
        mobile: agentData.mobile.trim(),
        role: agentData.role,
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
    }
  };

  const handleToggleStatus = async (user) => {
    if (!user || updatingUserId) return;
    const currentActive = (user.status || "active").toLowerCase() === "active";
    const nextStatus = currentActive ? "inactive" : "active";

    try {
      setUpdatingUserId(user.id);
      await updateUserMutation.mutateAsync({
        userId: user.id,
        fields: { status: nextStatus },
      });
      toast.success(
        `User ${user.name || `#${user.id}`} ${
          nextStatus === "active" ? "activated" : "deactivated"
        } successfully.`
      );
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || "Failed to update account status";
      toast.error(errMsg);
    } finally {
      setUpdatingUserId(null);
    }
  };
  
  return (
    <>
      <AdminUserTable
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
        onToggleStatus={handleToggleStatus}
        updatingUserId={updatingUserId}
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