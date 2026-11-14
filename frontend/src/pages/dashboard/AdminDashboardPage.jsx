import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAdminDashboard } from '../../features/admin/hooks/useAdminDashboard';
import { AdminSidebar } from '../../features/admin/components/AdminSidebar';
import { AdminHeader } from '../../features/admin/components/AdminHeader';
import { DashboardOverview } from '../../features/admin/components/DashboardOverview';
import { AdminUserTable } from '../../features/admin/components/AdminUserTable';

import { CommandSearchModal } from '../../features/admin/modals/CommandSearchModal';
import { ActionModal } from '../../features/admin/modals/ActionModal';
import { AddAgentModal } from '../../features/admin/modals/AddAgentModal';

export default function AdminDashboardPage() {
  const {
    // Navigation
    activeTab,
    setActiveTab,
    sidebarCollapsed,
    setSidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    openNavCategory,
    toggleCategory,
    getCurrentRoleTitle,

    // Real Data & Stats
    users,
    filteredMembers,
    isLoadingUsers,
    stats,
    loadUsers,

    // Filters
    memberSearch,
    setMemberSearch,
    statusFilter,
    setStatusFilter,
    cmdSearchQuery,
    setCmdSearchQuery,

    // Modals
    showCommandModal,
    setShowCommandModal,
    actionModalUser,
    setActionModalUser,
    addAgentModalOpen,
    setAddAgentModalOpen,

    // Actions
    handleOnboardAgent,
    handleUpdateMemberDetails,
    handleExportCSV,
  } = useAdminDashboard();

  const location = useLocation();

  // Sync route with active dashboard tab & modals
  useEffect(() => {
    if (location.pathname.includes('/admin/users/create')) {
      setActiveTab('all-users');
      setAddAgentModalOpen(true);
    } else if (location.pathname.includes('/admin/users')) {
      setActiveTab('all-users');
    } else if (location.pathname.includes('/admin/kyc')) {
      setActiveTab('all-users');
    } else if (location.pathname.includes('/admin/dashboard')) {
      setActiveTab('dashboard');
    }
  }, [location.pathname, setActiveTab, setAddAgentModalOpen]);

  return (
    <div className="min-h-screen bg-slate-100 flex font-sans text-slate-800 antialiased">
      {/* Admin Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        openNavCategory={openNavCategory}
        toggleCategory={toggleCategory}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-64'
        }`}
      >
        {/* Top Header */}
        <AdminHeader
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          setMobileSidebarOpen={setMobileSidebarOpen}
          setShowCommandModal={setShowCommandModal}
          loadUsers={loadUsers}
          isLoadingUsers={isLoadingUsers}
        />

        {/* Dynamic Main Workspace Views - Backend-Backed Only */}
        <main className="p-4 md:p-6 lg:p-8 flex-1">
          {activeTab === 'dashboard' ? (
            <DashboardOverview
              stats={stats}
              setActiveTab={setActiveTab}
              setAddAgentModalOpen={setAddAgentModalOpen}
              loadUsers={loadUsers}
              isLoadingUsers={isLoadingUsers}
            />
          ) : (
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
            />
          )}
        </main>
      </div>

      {/* Global Quick Search Modal */}
      <CommandSearchModal
        showCommandModal={showCommandModal}
        setShowCommandModal={setShowCommandModal}
        cmdSearchQuery={cmdSearchQuery}
        setCmdSearchQuery={setCmdSearchQuery}
        setActiveTab={setActiveTab}
      />

      {/* Edit Agent Configuration Modal */}
      <ActionModal
        actionModalUser={actionModalUser}
        setActionModalUser={setActionModalUser}
        handleUpdateMemberDetails={handleUpdateMemberDetails}
      />

      {/* Add New Agent Modal */}
      <AddAgentModal
        addAgentModalOpen={addAgentModalOpen}
        setAddAgentModalOpen={setAddAgentModalOpen}
        handleOnboardAgent={handleOnboardAgent}
      />
    </div>
  );
}
