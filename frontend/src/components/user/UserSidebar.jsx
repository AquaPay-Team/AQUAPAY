import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShieldCheck,
  Zap,
  Building2,
  Store,
  FileSignature,
  User,
  Settings,
  LogOut,
  ChevronDown,
  X,
  CreditCard
} from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { toast } from "sonner";
import { getRoleNavigation } from "../../config/roleNavigation";
import { getRoleMeta } from "../../constants/roles";

export function UserSidebar({
  collapsed = false,
  mobileOpen = false,
  setMobileOpen = () => {},
  onOpenCreateAgentModal,
}) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Partner",
    slug: "RT",
  };

  const navItems = getRoleNavigation(currentUser);

  const [openGroups, setOpenGroups] = useState({
    "sa-team": true,
    "nsm-team": true,
    "sh-team": true,
    "cnf-team": true,
    "md-team": true,
    "dt-team": true,
    "rt-kyc": true,
  });

  const toggleGroup = (groupId) => {
    setOpenGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully");
    navigate("/login/user", { replace: true });
  };

  const isCurrentActive = (item) => {
    if (!item.path) return false;
    if (location.pathname === item.path) return true;
    if (item.path !== "/user/dashboard" && location.pathname.startsWith(item.path)) {
      return true;
    }
    return false;
  };

  const handleNavClick = (item) => {
    if (setMobileOpen) setMobileOpen(false);

    if (item.path === "/user/team/create" && onOpenCreateAgentModal) {
      onOpenCreateAgentModal();
      return;
    }

    if (item.path) {
      navigate(item.path);
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
      case "Zap":
        return Zap;
      case "Building2":
        return Building2;
      case "Store":
        return Store;
      case "FileSignature":
        return FileSignature;
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
        collapsed ? "w-20" : "w-64"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <Link to="/user/dashboard" className="flex items-center gap-2 overflow-hidden">
          <img
            src="/aquapay-logo.jpeg"
            alt="AquaPay Logo"
            className="h-14 w-auto object-contain select-none"
          />
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Dynamic Role Badge Header */}
      {!collapsed && (
        <div className="px-4 py-2 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-[11px]">
          <span className="font-bold text-slate-700 truncate max-w-[130px]">
            {currentUser.name || "Member"}
          </span>
          <span className="bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full text-[10px] shrink-0">
            {roleMeta.name}
          </span>
        </div>
      )}

      {/* Dynamic Role-Based Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 text-xs custom-scrollbar">
        {navItems.map((item) => {
          const IconComp = getIcon(item.icon);

          if (item.children && item.children.length > 0) {
            const isGroupOpen = openGroups[item.id];
            return (
              <div key={item.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className="w-4 h-4 text-blue-600 shrink-0" />
                    {!collapsed && (
                      <span className="font-semibold text-slate-800">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                        isGroupOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {isGroupOpen && !collapsed && (
                  <div className="pl-6 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-4 mt-0.5">
                    {item.children.map((sub) => {
                      const SubIcon = getIcon(sub.icon);
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
                          <SubIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
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
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors cursor-pointer ${
                active
                  ? "bg-blue-50 text-blue-700 font-bold border-r-4 border-blue-600 shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <IconComp className="w-4 h-4 text-blue-600 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50 text-[11px] text-slate-500 flex items-center justify-between shrink-0">
        {!collapsed && (
          <span className="flex items-center gap-1.5 font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Verified Partner
          </span>
        )}
        <button
          onClick={handleLogout}
          title="Sign Out"
          className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 font-medium transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default UserSidebar;
