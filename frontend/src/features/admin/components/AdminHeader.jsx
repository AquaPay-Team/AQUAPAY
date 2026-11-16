import React, { useState } from 'react';
import {
  Menu,
  Search,
  LogOut,
  CreditCard,
  Bell,
  User,
  CheckCircle2,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';

export function AdminHeader({
  sidebarCollapsed,
  setSidebarCollapsed,
  setMobileSidebarOpen,
  setShowCommandModal,
  loadUsers,
  isLoadingUsers
}) {
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(
        localStorage.getItem("adminUser") ||
          localStorage.getItem("user") ||
          "{}"
      );
    } catch {
      return {};
    }
  })();

  const adminName = currentUser.name || "Administrator";
  const adminRole = currentUser.role_name || (currentUser.role_id === 1 ? "Super Admin" : "Admin");
  const initials =
    adminName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully from Admin Console");
    navigate("/login/admin", { replace: true });
  };

  return (
    <header className="h-[68px] bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-2xs relative">
      {/* Left: Sidebar Toggle & Search Bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search Bar (opens Ctrl+K modal on click) */}
        <button
          onClick={() => setShowCommandModal(true)}
          className="relative hidden sm:flex items-center gap-2 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64 md:w-80 text-slate-400 hover:border-slate-300 hover:bg-white transition-all cursor-pointer text-left"
        >
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <span>Search users, menus, reports...</span>
          <kbd className="ml-auto text-[10px] font-semibold bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: Wallet Balance, Notifications & User Avatar */}
      <div className="flex items-center gap-3">
        {/* Balance / Wallet Pill */}
        <div
          onClick={() => toast.info("Super Admin Core Settlement & Reserve Account")}
          className="flex items-center gap-2 border border-blue-600 bg-white hover:bg-blue-50/50 text-blue-600 font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-2xs cursor-pointer"
          title="Admin Settlement Balance"
        >
          <CreditCard className="w-4 h-4 text-black" />
          <span>₹ 0.00</span>
        </div>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setUserMenuOpen(false);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white" />
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationOpen && (
            <div className="absolute right-0 top-12 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-800 text-sm">System Notifications</span>
                <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Live Sync
                </span>
              </div>
              <div className="py-3 space-y-3">
                <div className="flex items-start gap-3 p-2.5 rounded-xl bg-blue-50/60 border border-blue-100/60">
                  <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                    ✓
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-slate-900 text-xs">Admin Console Operational</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      All core authentication and identity compliance gateways are connected.
                    </p>
                    <span className="text-[10px] text-slate-400 mt-1 block">Just Now</span>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                >
                  Close Notifications
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs overflow-hidden shadow-2xs">
              {initials}
            </div>
          </button>

          {/* User Profile Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <span className="font-bold text-slate-900 block truncate">
                  {adminName}
                </span>
                <span className="text-[10px] text-blue-600 font-semibold uppercase">
                  {adminRole} Terminal
                </span>
              </div>
              <Link
                to="/admin/users"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Users className="w-4 h-4 text-slate-400" />
                <span>User Directory</span>
              </Link>
              <Link
                to="/admin/kyc"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>KYC Verification Queue</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors mt-1 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default AdminHeader;
