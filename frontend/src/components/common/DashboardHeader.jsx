import React, { useState } from "react";
import { Menu, RefreshCw, LogOut, CheckCircle2, Search, CreditCard, Bell, User } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { getRoleMeta } from "../../constants/roles";

export function DashboardHeader({
  collapsed,
  setCollapsed,
  setMobileOpen,
  onRefresh,
  isRefreshing,
}) {
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Partner",
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully");
    navigate("/login/user", { replace: true });
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-2xs relative">
      {/* Left: Sidebar Toggle & Search Bar */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMobileOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global Search (Matching Screenshot) */}
        <div className="relative hidden sm:block">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Ctrl + K"
            className="pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-64 md:w-80 text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition-all"
          />
        </div>
      </div>

      {/* Right: Wallet Balance, Notifications & User Avatar */}
      <div className="flex items-center gap-3">
        {/* Wallet Balance Pill (Matching Screenshot) */}
        <div className="flex items-center gap-2 border border-blue-600 bg-white hover:bg-blue-50/50 text-blue-600 font-bold px-3 py-1.5 rounded-lg text-xs transition shadow-2xs cursor-pointer">
          <CreditCard className="w-4 h-4 text-blue-600" />
          <span>₹ 0.00</span>
        </div>

        {/* Notification Bell with Badge (Matching Screenshot 5) */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
              setUserMenuOpen(false);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
              1
            </span>
          </button>

          {/* Notification Popover (Exact Match to Screenshot 5) */}
          {notificationOpen && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-900 text-sm">Notification</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="flex-1 text-xs">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-bold text-slate-800 leading-snug">
                      Your onboarding has been completed successfully.
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">Just Now</span>
                  </div>
                  <p className="text-slate-500 mt-1">Welcome to the platform</p>
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 text-center">
                <button
                  onClick={() => setNotificationOpen(false)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                >
                  View All
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Profile Avatar */}
        <div className="relative">
          <button
            onClick={() => {
              setUserMenuOpen(!userMenuOpen);
              setNotificationOpen(false);
            }}
            className="flex items-center gap-2 cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-xs overflow-hidden shadow-2xs">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
          </button>

          {/* User Profile Dropdown Menu */}
          {userMenuOpen && (
            <div className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 animate-in fade-in zoom-in-95 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 mb-1">
                <span className="font-bold text-slate-900 block truncate">
                  {currentUser.name || "Member"}
                </span>
                <span className="text-[10px] text-blue-600 font-semibold uppercase">
                  {roleMeta.name} Terminal
                </span>
              </div>
              <Link
                to="/user/profile"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <User className="w-4 h-4 text-slate-400" />
                <span>My Profile</span>
              </Link>
              <Link
                to="/user/kyc"
                onClick={() => setUserMenuOpen(false)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span>KYC Verification</span>
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

export default DashboardHeader;
