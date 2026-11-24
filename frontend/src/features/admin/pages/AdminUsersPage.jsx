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

export default function AdminUsersPage() {
  const [searchParams] = useSearchParams();
  const selectedRoleId = searchParams.get("roleId") || "";

  // Data fetching via TanStack Query
  const { data: users = [], isLoading: isLoadingUsers } = useUsers(selectedRoleId);
  const { data: permittedRoles = [] } = useDescendantRoles();

  // Local filtering state
  const [memberSearch, setMemberSearch] = useState("");
  const [kycFilter, setKycFilter] = useState("All");
  const [accountFilter, setAccountFilter] = useState("All");

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

  const resetAllFilters = () => {
    setMemberSearch("");
    setKycFilter("All");
    setAccountFilter("All");
  };

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return users.filter((u) => {
      // 1. Text Search
      const q = memberSearch.toLowerCase().trim();
      const searchMatch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.shopname && u.shopname.toLowerCase().includes(q)) ||
        String(u.id).includes(q);

      if (!searchMatch) return false;

      // 2. Account Status Filter
      const accountStatus = String(u.status || "active").toLowerCase();
      if (accountFilter === "Active" && accountStatus !== "active") return false;
      if (accountFilter === "Inactive" && accountStatus === "active") return false;

      // 3. KYC Status Filter
      const rawKyc = u.kyc?.status || u.kyc_status || (typeof u.kyc === "string" ? u.kyc : "");
      const kycStatus = String(rawKyc || "pending").toLowerCase();

      if (kycFilter === "Pending" && kycStatus !== "pending") return false;
      if (kycFilter === "Under Review" && kycStatus !== "under_review" && kycStatus !== "submitted") return false;
      if (kycFilter === "Verified" && kycStatus !== "approved" && kycStatus !== "verified" && kycStatus !== "completed") return false;
      if (kycFilter === "Rejected" && kycStatus !== "rejected" && accountStatus !== "rejected") return false;

      return true;
    });
  }, [users, memberSearch, kycFilter, accountFilter]);

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
        setMemberSearch={setMemberSearch}
        kycFilter={kycFilter}
        setKycFilter={setKycFilter}
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        hasActiveFilters={hasActiveFilters}
        resetAllFilters={resetAllFilters}
        filteredMembers={filteredMembers}
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
      />
    </>
  );
}