import React from 'react';
import { Search, X, ChevronRight } from 'lucide-react';

export function CommandSearchModal({
  showCommandModal,
  setShowCommandModal,
  cmdSearchQuery,
  setCmdSearchQuery,
  setActiveTab
}) {
  if (!showCommandModal) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-20 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            type="text"
            autoFocus
            placeholder="Search menus, users by ID or mobile, or reports..."
            value={cmdSearchQuery}
            onChange={(e) => setCmdSearchQuery(e.target.value)}
            className="w-full text-sm outline-none text-slate-800 placeholder-slate-400"
          />
          <button
            onClick={() => setShowCommandModal(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-3 max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
          <div className="pb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-2">
              Quick View Navigation
            </span>
            <div className="mt-1 space-y-1">
              {[
                { label: 'Dashboard Overview', tab: 'dashboard' },
                { label: 'All Users Directory', tab: 'all-users' },
                { label: 'Retailer Management', tab: 'retailer' },
                { label: 'Distributor Network', tab: 'distributor' },
                { label: 'Sub Admin Directory', tab: 'sub-admin' }
              ].map((item) => (
                <button
                  key={item.tab}
                  onClick={() => {
                    setActiveTab(item.tab);
                    setShowCommandModal(false);
                  }}
                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between transition-colors"
                >
                  <span>{item.label}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
