import React from 'react';
import {
  Menu,
  Search,
  LogOut,
  RefreshCw,
  Server
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { adminLogout } from '../services/adminApi';

export function AdminHeader({
  sidebarCollapsed,
  setSidebarCollapsed,
  setMobileSidebarOpen,
  setShowCommandModal,
  loadUsers,
  isLoadingUsers
}) {
  const navigate = useNavigate();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || localStorage.getItem("adminUser") || "{}");
    } catch {
      return {};
    }
  })();

  const adminName = currentUser.name || "AquaPay Member";
  const adminRole = currentUser.role_name || (currentUser.role_id === 1 ? "Admin" : "Agent");
  const initials = adminName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "AP";

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully");
    navigate("/login/admin", { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-xs">
      {/* Left: Sidebar Toggle & Search */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Command Search Box */}
        <div
          onClick={() => setShowCommandModal(true)}
          className="hidden sm:flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-400 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-all w-60 md:w-72"
        >
          <Search className="w-4 h-4 text-slate-400" />
          <span className="flex-1 text-slate-400 text-xs">Search </span>
          <kbd className="bg-white border border-slate-200 text-[10px] text-slate-500 px-1.5 py-0.5 rounded shadow-2xs font-mono">
            (Ctrl + K)
          </kbd>
        </div>
      </div>

      {/* Right Header Actions */}
      <div className="flex items-center gap-3">
        {/* Refresh Backend Users button */}
        {/* {loadUsers && (
          <button
            onClick={loadUsers}
            disabled={isLoadingUsers}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            title="Sync user list from backend database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingUsers ? 'animate-spin text-blue-600' : ''}`} />
            <span className="hidden sm:inline">Sync DB</span>
          </button>
        )} */}

        {/* Backend API Connection Indicator */}
        {/* <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
          <Server className="w-3.5 h-3.5 text-emerald-600" />
          <span>Core API Active</span>
        </div> */}

        {/* Super Admin Profile Avatar & Logout */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
          {/* <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-xs shadow-xs">
            {initials}
          </div> */}
          <div className="hidden lg:flex flex-col text-left">
            <span className="text-xs font-bold text-slate-900 leading-tight">
              {adminName}
            </span>
            <span className="text-[10px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.2 rounded mt-0.5">
              {adminRole}
            </span>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out of Admin Console"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
