import React, { useEffect, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { fetchBackendDescendantRoles } from "../../features/admin/services/adminApi";

export function RoleNavigationSection({
  collapsed = false,
  scope = "user",
  onNavigate,
  onExpandSidebar,
}) {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [roles, setRoles] = useState([]);
  const [loadState, setLoadState] = useState("idle");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [isManuallyExpanded, setIsManuallyExpanded] = useState(false);
  const basePath = scope === "admin" ? "/admin/users" : "/user/team";
  const roleDirectoryIsOpen = location.pathname === basePath || location.pathname.startsWith(`${basePath}/`);
  const isExpanded = roleDirectoryIsOpen || isManuallyExpanded;
  const selectedRoleId = searchParams.get("roleId");

  useEffect(() => {
    if (!isExpanded) return undefined;

    let active = true;
    Promise.resolve().then(() => {
      if (active) setLoadState("loading");
    });
    fetchBackendDescendantRoles()
      .then((response) => {
        if (!active) return;
        setRoles(Array.isArray(response?.data) ? response.data : []);
        setLoadState("loaded");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState("error");
        console.warn("Could not load permitted role directories", {
          status: error?.response?.status,
          code: error?.response?.data?.code,
        });
      });

    return () => {
      active = false;
    };
  }, [isExpanded, loadAttempt]);

  const toggleRoles = () => {
    if (collapsed) {
      onExpandSidebar?.();
      setIsManuallyExpanded(true);
      return;
    }
    if (!roleDirectoryIsOpen) setIsManuallyExpanded((open) => !open);
  };

  return (
    <div className="py-0.5">
      <button
        type="button"
        aria-expanded={isExpanded}
        title={collapsed ? "Roles" : undefined}
        onClick={toggleRoles}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
      >
        <span className="flex items-center gap-3">
          <Users className="w-[18px] h-[18px] text-black shrink-0" />
          {!collapsed && <span className="font-semibold text-slate-800">Roles</span>}
        </span>
        {!collapsed && (
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {isExpanded && !collapsed && (
        <div className="pl-7 pr-1 py-1 space-y-0.5 border-l-2 border-slate-100 ml-5 mt-0.5">
          {loadState === "loading" && (
            <div className="px-3 py-2 text-[11px] text-slate-400">Loading roles...</div>
          )}
          {loadState === "error" && (
            <div role="alert" className="px-3 py-2 text-[11px] text-rose-600">
              Roles could not be loaded. <button type="button" className="underline" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Try again</button>
            </div>
          )}
          {loadState === "loaded" && roles.length === 0 && (
            <div className="px-3 py-2 text-[11px] text-slate-400">
              No descendant roles are available.
            </div>
          )}
          {roles.map((role) => {
            const active = String(role.id) === String(selectedRoleId);
            return (
              <Link
                key={role.id}
                to={`${basePath}?roleId=${encodeURIComponent(role.id)}`}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={`w-full text-left px-3 py-2 rounded-lg text-[13px] transition-colors flex items-center gap-2.5 ${
                  active
                    ? "bg-blue-50 text-blue-700 font-bold shadow-2xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="truncate">{role.name} ({role.slug})</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RoleNavigationSection;
