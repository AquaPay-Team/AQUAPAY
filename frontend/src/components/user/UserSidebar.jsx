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
  CreditCard,
  Wallet,
  FileText,
  Send,
  QrCode,
  Landmark
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
      case "Wallet":
        return Wallet;
      case "CreditCard":
        return CreditCard;
      case "FileText":
        return FileText;
      case "Send":
        return Send;
      case "QrCode":
        return QrCode;
      case "Landmark":
        return Landmark;
      default:
        return LayoutDashboard;
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 bg-white border-r border-slate-200 transition-all duration-300 ease-in-out flex flex-col ${
        collapsed ? "w-20" : "w-72"
      } ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
    >
      {/* Brand Header */}
      <div className="h-[68px] px-5 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
        <Link to="/user/dashboard" className="flex items-center gap-2 overflow-hidden">
          <img
            src="/aquapay-logo.jpeg"
            alt="AquaPay Logo"
            className="h-14 w-auto object-contain select-none"
          />
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="md:hidden text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Dynamic Role Badge Header */}
      {!collapsed && (
        <div className="px-5 py-2.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-700 truncate max-w-[150px]">
            {currentUser.name || "Member"}
          </span>
          <span className="bg-blue-100 text-blue-700 font-bold px-2.5 py-0.5 rounded-full text-[10px] shrink-0">
            {roleMeta.name}
          </span>
        </div>
      )}

      {/* Dynamic Role-Based Navigation Items */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-1 text-[13px] custom-scrollbar">
        {navItems.map((item) => {
          const IconComp = getIcon(item.icon);

          if (item.children && item.children.length > 0) {
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
                    {!collapsed && (
                      <span className="font-semibold text-slate-800">
                        {item.label}
                      </span>
                    )}
                  </div>
                  {!collapsed && (
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isGroupOpen ? "rotate-180" : ""
                      }`}
                    />
                  )}
                </button>

                {isGroupOpen && !collapsed && (
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
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 text-xs text-slate-500 flex items-center justify-between shrink-0">
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
          <LogOut className="w-4 h-4" />
          {!collapsed && <span>Sign Out</span>}
        </button>
      </div>
    </aside>
  );
}

export default UserSidebar;