import React, { useEffect, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdminDashboard } from '../../features/admin/hooks/useAdminDashboard';
import { AdminSidebar } from '../../features/admin/components/AdminSidebar';
import { AdminHeader } from '../../features/admin/components/AdminHeader';
import { DashboardOverview } from '../../features/admin/components/DashboardOverview';
import { AdminUserTable } from '../../features/admin/components/AdminUserTable';

import { CommandSearchModal } from '../../features/admin/modals/CommandSearchModal';
import { ActionModal } from '../../features/admin/modals/ActionModal';
import { AddAgentModal } from '../../features/admin/modals/AddAgentModal';
import UserProfile from '../user/UserProfile';
import AdminKycReview from '../../features/admin/components/AdminKycReview';

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
    permittedRoles,
    selectedRoleId,
    setSelectedRoleId,

    // Real Data & Stats
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
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRoleId = searchParams.get('roleId') || '';
  const targetUserMatch = location.pathname.match(/^\/admin\/users\/(\d+)$/);
  const isProfileRoute = location.pathname === '/admin/profile' || Boolean(targetUserMatch);
  const isDirectoryRoute = location.pathname === '/admin/users';
  const selectedRole = permittedRoles.find((role) => String(role.id) === String(selectedRoleId));
  const directoryRoleId = selectedRole ? String(selectedRole.id) : '';
  const previousDirectoryRef = useRef({ pathname: location.pathname, roleId: directoryRoleId });

  // Keep the selected role in the URL so direct links and refreshes retain the directory.
  useEffect(() => {
    if (location.pathname === '/admin/users/create') {
      navigate('/admin/users', { replace: true });
      return;
    }

    if (location.pathname === '/admin/users') {
      setActiveTab('all-users');
      setSelectedRoleId(requestedRoleId);
      if (requestedRoleId) loadUsers(requestedRoleId);
    } else if (location.pathname.includes('/admin/kyc')) {
      setActiveTab('kyc');
    } else if (location.pathname.includes('/admin/dashboard')) {
      setActiveTab('dashboard');
      setSelectedRoleId('');
      loadUsers();
    } else if (isProfileRoute) {
      setActiveTab('profile');
    }
  }, [location.pathname, location.search, requestedRoleId, isProfileRoute, navigate, setActiveTab, setSelectedRoleId, loadUsers]);

  useEffect(() => {
    const selectionChanged = previousDirectoryRef.current.pathname !== location.pathname ||
      previousDirectoryRef.current.roleId !== directoryRoleId;
    if (!isDirectoryRoute || !directoryRoleId || selectionChanged) setAddAgentModalOpen(false);
    previousDirectoryRef.current = { pathname: location.pathname, roleId: directoryRoleId };
  }, [isDirectoryRoute, location.pathname, directoryRoleId, setAddAgentModalOpen]);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Admin Sidebar Navigation */}
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
        openNavCategory={openNavCategory}
        toggleCategory={toggleCategory}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? 'md:ml-20' : 'md:ml-72'
        }`}
      >
        {/* Top Header */}
        <AdminHeader
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          setMobileSidebarOpen={setMobileSidebarOpen}
          setShowCommandModal={setShowCommandModal}
        />

        {/* Dynamic Main Workspace Views - Backend-Backed Only */}
        <main className="p-4 md:p-6 lg:p-8 flex-1">
          {isProfileRoute ? (
            <UserProfile targetUserId={targetUserMatch?.[1]} />
          ) : location.pathname === '/admin/kyc' ? (
            <AdminKycReview />
          ) : activeTab === 'dashboard' ? (
            <DashboardOverview
              stats={stats}
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
              filteredMembers={directoryRoleId ? filteredMembers : []}
              handleExportCSV={handleExportCSV}
              setAddAgentModalOpen={setAddAgentModalOpen}
              setActionModalUser={setActionModalUser}
              isLoadingUsers={Boolean(directoryRoleId) && isLoadingUsers}
              selectedRoleId={directoryRoleId}
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
        selectedRole={selectedRole?.slug || ""}
      />
    </div>
  );
}
