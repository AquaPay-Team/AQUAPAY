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
  Server
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
      if (item.id === "admin-all-users" && (activeTab === "all-users" || activeTab === "users")) return true;
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

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col ${
        sidebarCollapsed ? "w-20" : "w-64"
      } ${
        mobileSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <Link to="/admin/dashboard" className="flex items-center gap-2.5 overflow-hidden">
          <img
            src="/aquapay-logo.jpeg"
            alt="AquaPay Logo"
            className="h-16 w-auto object-contain select-none"
          />
        </Link>
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 p-1"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Tree */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 text-xs custom-scrollbar">
        {navItems.map((item) => {
          if (item.children) {
            const isGroupOpen = openGroups[item.id];
            return (
              <div key={item.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-blue-600 shrink-0" />
                    {!sidebarCollapsed && (
                      <span className="font-semibold text-slate-800">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!sidebarCollapsed && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isGroupOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {isGroupOpen && !sidebarCollapsed && (
                  <div className="pl-7 pr-1 py-1 space-y-1 border-l-2 border-slate-100 ml-4 mt-0.5">
                    {item.children.map((sub) => {
                      const active = isCurrentActive(sub);
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          onClick={() => handleNavClick(sub)}
                          className={`w-full text-left px-3 py-1.5 rounded-md text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                            active
                              ? "bg-blue-50 text-blue-700 font-bold shadow-2xs"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          {sub.id === "admin-create-user" ? (
                            <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                          ) : (
                            <Users className="w-3.5 h-3.5 text-slate-400" />
                          )}
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = isCurrentActive(item);
          let IconComponent = LayoutDashboard;
          if (item.icon === "ShieldCheck") IconComponent = ShieldCheck;
          else if (item.icon === "BarChart3") IconComponent = BarChart3;
          else if (item.icon === "User") IconComponent = User;
          else if (item.icon === "Settings") IconComponent = Settings;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavClick(item)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                active
                  ? "bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <IconComponent className="w-4 h-4 shrink-0 text-blue-600" />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Info & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        {!sidebarCollapsed && (
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Admin Online
          </span>
        )}
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!sidebarCollapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default AdminSidebar;
