import React, { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { AdminUserTable } from "../components/AdminUserTable";
import { ActionModal } from "../modals/ActionModal";
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
  const [statusFilter, setStatusFilter] = useState("All");

  // Modals state
  const [actionModalUser, setActionModalUser] = useState(null);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

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

  // Filtered members list
  const filteredMembers = useMemo(() => {
    return users.filter((u) => {
      const q = memberSearch.toLowerCase().trim();
      const searchMatch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.shopname && u.shopname.toLowerCase().includes(q)) ||
        String(u.id).includes(q);

      const statusMatch =
        statusFilter === "All"
          ? true
          : statusFilter === "Active"
          ? u.status === "active"
          : u.status !== "active";

      return searchMatch && statusMatch;
    });
  }, [users, memberSearch, statusFilter]);

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

  const handleUpdateMemberDetails = async (userId, updatedFields) => {
    try {
      await updateUserMutation.mutateAsync({ userId, fields: updatedFields });
      toast.success("User profile updated successfully.");
      setActionModalUser(null);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to update agent details";
      toast.error(errMsg);
    }
  };

  return (
    <>
      <AdminUserTable
        getCurrentRoleTitle={getCurrentRoleTitle}
        memberSearch={memberSearch}
        setMemberSearch={setMemberSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        filteredMembers={filteredMembers}
        handleExportCSV={handleExportCSV}
        setAddAgentModalOpen={setAddAgentModalOpen}
        setActionModalUser={setActionModalUser}
        isLoadingUsers={isLoadingUsers}
        selectedRoleId={selectedRoleId}
      />

      <ActionModal
        actionModalUser={actionModalUser}
        setActionModalUser={setActionModalUser}
        handleUpdateMemberDetails={handleUpdateMemberDetails}
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