import { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import {
  fetchBackendUsers,
  createBackendUser,
  updateBackendUser,
  adminLogout
} from '../services/adminApi';

export function useAdminDashboard() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [openNavCategory, setOpenNavCategory] = useState({
    Member: true,
  });

  const toggleCategory = useCallback((cat) => {
    setOpenNavCategory((prev) => ({ ...prev, [cat]: !prev[cat] }));
  }, []);

  // Real Database Users State
  const [users, setUsers] = useState([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  // Search & Filter State
  const [memberSearch, setMemberSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [cmdSearchQuery, setCmdSearchQuery] = useState('');

  // Modals
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [actionModalUser, setActionModalUser] = useState(null);
  const [addAgentModalOpen, setAddAgentModalOpen] = useState(false);

  // Fetch real users from backend API
  const loadUsers = useCallback(async () => {
    try {
      setIsLoadingUsers(true);
      const res = await fetchBackendUsers();
      if (res && res.data) {
        setUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to load users from backend:', err);
      toast.error('Unable to fetch users from backend database');
    } finally {
      setIsLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Current active view heading helper
  const getCurrentRoleTitle = useCallback(() => {
    switch (activeTab) {
      case 'all-users':
        return 'All Users';
      case 'retailer':
        return 'Retailer';
      case 'distributor':
        return 'Distributor';
      case 'master-distributor':
        return 'Master Distributor';
      case 'cnf-asm':
        return 'CNF / ASM';
      case 'sh':
        return 'State Head (SH)';
      case 'nsm-zsh':
        return 'NSM / ZSH';
      case 'sub-admin':
        return 'Sub Admin';
      default:
        return 'Member';
    }
  }, [activeTab]);

  // Filtered members list based on real backend data
  const filteredMembers = useMemo(() => {
    return users.filter((u) => {
      // Role filtering
      const roleName = String(u.role_name || '').toLowerCase();
      const roleSlug = String(u.role_slug || '').toLowerCase();

      let roleMatch = true;
      if (activeTab === 'retailer') {
        roleMatch = roleName === 'retailer' || roleSlug === 'rt';
      } else if (activeTab === 'distributor') {
        roleMatch = roleName === 'distributor' || roleSlug === 'dt';
      } else if (activeTab === 'master-distributor') {
        roleMatch = roleName.includes('master') || roleSlug === 'md';
      } else if (activeTab === 'cnf-asm') {
        roleMatch = roleName.includes('cnf') || roleSlug === 'cnf';
      } else if (activeTab === 'sh') {
        roleMatch = roleName === 'sh' || roleSlug === 'sh';
      } else if (activeTab === 'nsm-zsh') {
        roleMatch = roleName.includes('nsm') || roleSlug === 'nsm';
      } else if (activeTab === 'sub-admin') {
        roleMatch = roleName.includes('sub admin') || roleSlug === 'sa';
      }

      // Search matching: name, mobile, email, shopname, id
      const q = memberSearch.toLowerCase().trim();
      const searchMatch =
        !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.mobile && u.mobile.includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.shopname && u.shopname.toLowerCase().includes(q)) ||
        String(u.id).includes(q);

      // Status matching: 'active' / 'inactive'
      const statusMatch =
        statusFilter === 'All'
          ? true
          : statusFilter === 'Active'
          ? u.status === 'active'
          : u.status !== 'active';

      return roleMatch && searchMatch && statusMatch;
    });
  }, [users, activeTab, memberSearch, statusFilter]);

  // Real backend user creation
  const handleOnboardAgent = useCallback(
    async (agentData) => {
      try {
        const payload = {
          name: agentData.name.trim(),
          email: agentData.email.trim().toLowerCase(),
          mobile: agentData.mobile.trim(),
          role: agentData.role, // role slug (e.g. 'RT', 'DT', 'MD', 'CNF', 'SH', 'NSM', 'SA')
          password: agentData.password || 'Welcome@123',
          shopname: agentData.shopname?.trim() || null,
          city: agentData.city?.trim() || null,
          state: agentData.state?.trim() || null,
          address: agentData.address?.trim() || null,
          pincode: agentData.pincode ? String(agentData.pincode).trim() : null,
        };

        const res = await createBackendUser(payload);
        if (res && res.data) {
          setUsers((prev) => [res.data, ...prev]);
          toast.success(`Agent ${res.data.name} onboarded successfully in database!`);
          setAddAgentModalOpen(false);
        }
      } catch (err) {
        console.error('Failed to create agent:', err);
        const errMsg =
          err.response?.data?.message || err.message || 'Failed to onboard agent';
        toast.error(errMsg);
      }
    },
    []
  );

  // Real backend user details update
  const handleUpdateMemberDetails = useCallback(
    async (userId, updatedFields) => {
      try {
        const res = await updateBackendUser(userId, updatedFields);
        if (res && res.data) {
          setUsers((prev) =>
            prev.map((u) => (u.id === userId ? { ...u, ...res.data } : u))
          );
          toast.success(`Agent #${userId} profile updated in database!`);
          setActionModalUser(null);
        }
      } catch (err) {
        console.error('Failed to update agent:', err);
        const errMsg =
          err.response?.data?.message || err.message || 'Failed to update agent details';
        toast.error(errMsg);
      }
    },
    []
  );

  // Export Real Users to CSV
  const handleExportCSV = useCallback(
    (filename, dataRows) => {
      if (!dataRows || !dataRows.length) {
        toast.error('No user data available to export');
        return;
      }
      const keys = ['id', 'name', 'email', 'mobile', 'role_name', 'shopname', 'city', 'state', 'status'];
      const headers = ['ID', 'Name', 'Email', 'Mobile', 'Role', 'Shop Name', 'City', 'State', 'Status'];

      const rows = dataRows.map((u) =>
        keys
          .map((k) => `"${String(u[k] || '').replace(/"/g, '""')}"`)
          .join(',')
      );

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success(`Exported ${filename}.csv with ${dataRows.length} real records`);
    },
    []
  );

  // Real statistics derived from database
  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.status === 'active').length;
    const retailers = users.filter(
      (u) =>
        String(u.role_name || '').toLowerCase() === 'retailer' ||
        String(u.role_slug || '').toLowerCase() === 'rt'
    ).length;
    const distributors = users.filter(
      (u) =>
        String(u.role_name || '').toLowerCase() === 'distributor' ||
        String(u.role_slug || '').toLowerCase() === 'dt'
    ).length;
    const pendingKyc = users.filter(
      (u) => !u.kyc || u.kyc?.status === 'pending' || u.kyc?.status === 'in_progress'
    ).length;
    const verifiedKyc = users.filter(
      (u) =>
        u.kyc?.status === 'verified' ||
        u.kyc?.status === 'completed' ||
        u.kyc?.status === 'submitted'
    ).length;

    return {
      total,
      active,
      retailers,
      distributors,
      pendingKyc,
      verifiedKyc,
    };
  }, [users]);

  return {
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

    // Actions backed by real Backend APIs
    handleOnboardAgent,
    handleUpdateMemberDetails,
    handleExportCSV,
    adminLogout,
  };
}

export default useAdminDashboard;
