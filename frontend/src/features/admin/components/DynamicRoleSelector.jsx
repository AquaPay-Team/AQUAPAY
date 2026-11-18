import React, { useState, useEffect } from "react";
import { ShieldCheck, ChevronDown, Loader2 } from "lucide-react";
import { fetchDescendantRoles } from "../services/adminApi";

export function DynamicRoleSelector({
  value,
  onChange,
  className = "",
  disabled = false,
  required = true,
}) {
  const [roles, setRoles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadRoles() {
      try {
        setIsLoading(true);
        const res = await fetchDescendantRoles();
        if (isMounted && res && res.data && Array.isArray(res.data)) {
          setRoles(res.data);
          // Set initial default role if not selected
          if (!value && res.data.length > 0) {
            onChange(res.data[0].slug || res.data[0].role_slug || "RT");
          }
        }
      } catch (err) {
        // Fallback default tier options if offline
        if (isMounted) {
          setRoles([
            { id: 8, name: "Retailer (RT)", slug: "RT" },
            { id: 7, name: "Distributor (DT)", slug: "DT" },
            { id: 6, name: "Master Distributor (MD)", slug: "MD" },
            { id: 5, name: "CNF / ASM (CNF)", slug: "CNF" },
            { id: 4, name: "State Head (SH)", slug: "SH" },
            { id: 3, name: "National Sales Manager (NSM)", slug: "NSM" },
            { id: 2, name: "Sub Admin (SA)", slug: "SA" },
          ]);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadRoles();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || isLoading}
        required={required}
        className={`w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-blue-500 font-medium appearance-none cursor-pointer disabled:opacity-60 ${className}`}
      >
        {isLoading ? (
          <option value="">Loading permitted roles...</option>
        ) : (
          roles.map((r) => {
            const roleSlug = r.slug || r.role_slug || r.code;
            const roleName = r.name || r.role_name;
            return (
              <option key={roleSlug || r.id} value={roleSlug}>
                {roleName} ({roleSlug})
              </option>
            );
          })
        )}
      </select>
      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
      </div>
    </div>
  );
}

export default DynamicRoleSelector;