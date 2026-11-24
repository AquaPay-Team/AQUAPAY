import React from "react";

export function SchemesTab() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Commission &amp; Surcharge Schemes</h3>
          <p className="text-xs text-slate-400 mt-0.5">Commercial packages applied to this account</p>
        </div>
        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg">
          Active Scheme
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400 font-medium">AePS Surcharge Slab</span>
          <p className="text-sm font-bold text-slate-800">Standard Tier A (0.20%)</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400 font-medium">DMT Commission Slab</span>
          <p className="text-sm font-bold text-slate-800">Retailer Flat ₹4.50</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400 font-medium">BBPS Utility Margins</span>
          <p className="text-sm font-bold text-slate-800">0.15% Cash Incentive</p>
        </div>
      </div>
    </div>
  );
}

export default SchemesTab;
