import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { UserSidebar } from "../components/user/UserSidebar";
import { DashboardHeader } from "../components/common/DashboardHeader";
import { AddAgentModal } from "../features/admin/modals/AddAgentModal";
import { createBackendUser } from "../features/admin/services/adminApi";
import { toast } from "sonner";

export function UserLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleId = Number(currentUser.role_id) || 8;
  const canManageAgents = roleId >= 2 && roleId <= 7;

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
        toast.success(`Agent ${res.data.name} onboarded successfully!`);
        setAddAgentModalOpen(false);
        // Dispatch event or callback to reload downline
        window.dispatchEvent(new Event("aquapay:downline_updated"));
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || err.message || "Failed to onboard agent";
      toast.error(errMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800 antialiased">
      {/* Dynamic Normal User Sidebar */}
      <UserSidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onOpenCreateAgentModal={() => setAddAgentModalOpen(true)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        <DashboardHeader
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
        />

        <main className="p-4 md:p-6 lg:p-8 flex-1">
          <Outlet context={{ onOpenAddAgent: () => setAddAgentModalOpen(true) }} />
        </main>
      </div>

      {/* Shared Add Agent Modal for Roles 2-7 */}
      {canManageAgents && (
        <AddAgentModal
          addAgentModalOpen={addAgentModalOpen}
          setAddAgentModalOpen={setAddAgentModalOpen}
          handleOnboardAgent={handleOnboardAgent}
        />
      )}
    </div>
  );
}

export default UserLayout;
