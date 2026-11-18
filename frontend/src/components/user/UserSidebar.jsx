import React, { useState } from "react";
import {
  LayoutDashboard,
  Users,
  UserPlus,
  ShieldCheck,
  ShieldAlert,
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
  Landmark,
  Award,
  MapPin,
  Building,
  Layers,
  Briefcase,
  ShoppingBag,
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
    const currentFull = location.pathname + location.search;
    if (currentFull === item.path) return true;
    if (!item.path.includes("?") && location.pathname === item.path && !location.search) {
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
      case "ShieldAlert":
        return ShieldAlert;
      case "Award":
        return Award;
      case "MapPin":
        return MapPin;
      case "Building":
        return Building;
      case "Layers":
        return Layers;
      case "Briefcase":
        return Briefcase;
      case "ShoppingBag":
        return ShoppingBag;
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
          className="md:hidden text-slate-400 hover:text-slate-600 p-1.5 cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Dynamic Role Badge Header (Exact Match to Image 1 & 2) */}
      {!collapsed && (
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-bold text-slate-800 truncate max-w-[140px]">
            {currentUser.name || "Karan Kumar"}
          </span>
          <span className="bg-sky-100 text-[#0284c7] font-semibold px-2.5 py-0.5 rounded-full text-[10px] shrink-0">
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
            const hasActiveChild = item.children.some((c) => isCurrentActive(c));
            return (
              <div key={item.id} className="py-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors cursor-pointer ${
                    hasActiveChild
                      ? "text-[#0284c7] font-semibold bg-sky-50/50"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <IconComp className={`w-4 h-4 shrink-0 ${hasActiveChild ? "text-[#0284c7]" : "text-slate-500"}`} />
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
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 cursor-pointer ${
                            active
                              ? "bg-sky-50 text-[#0284c7] font-semibold shadow-2xs"
                              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <SubIcon className={`w-3.5 h-3.5 shrink-0 ${active ? "text-[#0284c7]" : "text-slate-400"}`} />
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
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all cursor-pointer relative ${
                active
                  ? "bg-sky-50 text-[#0284c7] font-medium after:content-[''] after:absolute after:right-0 after:top-1/2 after:-translate-y-1/2 after:w-1.5 after:h-7 after:bg-[#0284c7] after:rounded-l-full shadow-2xs"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <IconComp className={`w-4 h-4 shrink-0 ${active ? "text-[#0284c7]" : "text-slate-500"}`} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          );
        })}
      </div>

      {/* Footer Profile & Logout */}
      <div className="p-3.5 border-t border-slate-100 bg-white text-xs text-slate-500 flex items-center justify-between shrink-0">
        {!collapsed && (
          <span className="flex items-center gap-2 font-medium text-slate-600">
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