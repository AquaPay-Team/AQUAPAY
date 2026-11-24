import React from "react";

export function ParentMappingTab({ profile }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-sm font-bold text-slate-900">Parent &amp; Sponsor Hierarchy</h3>
        <p className="text-xs text-slate-400 mt-0.5">Upline hierarchy and company node</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400">Parent / Sponsor Name</span>
          <p className="text-sm font-bold text-slate-800">
            {profile?.parent_name || "System Administrator"}
          </p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400">Assigned Company</span>
          <p className="text-sm font-bold text-slate-800">
            {profile?.company_name || "AquaPay Primary"}
          </p>
        </div>
      </div>
    </div>
  );
}

export default ParentMappingTab;
