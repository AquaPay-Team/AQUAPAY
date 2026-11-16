import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShieldCheck,
  BarChart3,
  User,
  Settings,
  LogOut,
  ChevronDown,
  X,
  CreditCard,
  Wallet,
  FileText,
  Send,
  QrCode,
  Landmark,
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { ROLE_NAVIGATION } from "../../config/roleNavigation";

export function AdminSidebar({
  sidebarCollapsed = false,
  mobileSidebarOpen = false,
  setMobileSidebarOpen = () => {},
  activeTab,
  setActiveTab,
  onOpenCreateModal,
}) {
  const navigate = useNavigate();
  const location = useLocation();

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

  const [openGroups, setOpenGroups] = useState({
    "admin-users": true,
  });

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully from Admin Console");
    navigate("/login/admin", { replace: true });
  };

  const navItems = ROLE_NAVIGATION.AD;

  const isCurrentActive = (item) => {
    if (activeTab && item.id) {
      if (item.id === "admin-dashboard" && activeTab === "dashboard") return true;
      if (
        item.id === "admin-all-users" &&
        (activeTab === "all-users" || activeTab === "users")
      )
        return true;
      if (item.id === "admin-kyc" && activeTab === "kyc") return true;
    }
    if (item.path && location.pathname === item.path) return true;
    return false;
  };

  const handleNavClick = (item) => {
    if (setMobileSidebarOpen) setMobileSidebarOpen(false);

    if (item.path) {
      navigate(item.path);
    }
    if (setActiveTab) {
      if (item.id === "admin-dashboard") setActiveTab("dashboard");
      else if (item.id === "admin-all-users") setActiveTab("all-users");
      else if (item.id === "admin-create-user") {
        if (onOpenCreateModal) onOpenCreateModal();
        setActiveTab("all-users");
      } else if (item.id === "admin-kyc") setActiveTab("kyc");
      else if (item.id === "admin-reports") setActiveTab("reports");
      else if (item.id === "admin-profile") setActiveTab("profile");
      else if (item.id === "admin-settings") setActiveTab("settings");
    }
  };

  const getIcon = (iconName) => {
    switch (iconName) {
      case "LayoutDashboard":
        return LayoutDashboard;
      case "Users":
        return Users;
      case "UserPlus":
        return UserPlus;
      case "ShieldCheck":
        return ShieldCheck;
      case "BarChart3":
        return BarChart3;
      case "User":
        return User;
      case "Settings":
        return Settings;
      default:
        return LayoutDashboard;
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col ${
        sidebarCollapsed ? "w-20" : "w-72"
      } ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Brand Header */}
      <div className="h-[68px] px-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <Link to="/admin/dashboard" className="flex items-center gap-2 overflow-hidden">
          <img
            src="/aquapay-logo.jpeg"
            alt="AquaPay Logo"
            className="h-14 w-auto object-contain select-none"
          />
        </Link>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Role Badge Header */}
      {!sidebarCollapsed && (
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 truncate max-w-[150px]">
            {adminName}
          </span>
          <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] shrink-0">
            {adminRole}
          </span>
        </div>
      )}

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1 text-[13px] custom-scrollbar">
        {navItems.map((item) => {
          const IconComp = getIcon(item.icon);

          if (item.children) {
            const isGroupOpen = openGroups[item.id];
            return (
              <div key={item.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <IconComp className="w-[18px] h-[18px] text-black shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="font-semibold text-slate-800">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isGroupOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {isGroupOpen && !sidebarCollapsed && (
                  <div className="pl-7 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-5 mt-0.5">
                    {item.children.map((sub) => {
                      const SubIcon = getIcon(sub.icon);
                      const active = isCurrentActive(sub);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavClick(sub)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2.5 cursor-pointer ${
                            active
                              ? "bg-blue-50 text-blue-700 font-bold shadow-2xs"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <SubIcon className="w-4 h-4 text-black shrink-0" />
                          <span className="truncate">{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isCurrentActive(item);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                active
                  ? "bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <IconComp className="w-[18px] h-[18px] text-black shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between shrink-0">
        {!sidebarCollapsed && (
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Admin Online
          </span>
        )}
        <button
          onClick={handleLogout}
          title="Sign Out of Admin Console"
          className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
