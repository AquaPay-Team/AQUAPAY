import React from "react";
import { Search, X, ChevronRight, User, Users, ShieldCheck, FileText, LayoutDashboard } from "lucide-react";

export function CommandSearchModal({
  showCommandModal,
  setShowCommandModal,
  cmdSearchQuery,
  setCmdSearchQuery,
  setActiveTab,
}) {
  if (!showCommandModal) return null;

  const quickNav = [
    { label: "Dashboard Overview", tab: "dashboard", icon: LayoutDashboard, desc: "Network metrics & operational stats" },
    { label: "All Users Directory", tab: "all-users", icon: Users, desc: "Manage all onboarded accounts & agents" },
    { label: "Retailer Management", tab: "retailer", icon: User, desc: "View all retail counter outlets" },
    { label: "Distributor Network", tab: "distributor", icon: Users, desc: "Manage tier-6 distributors" },
    { label: "Sub Admin Directory", tab: "sub-admin", icon: Users, desc: "Executive sub-admins" },
    { label: "KYC Compliance Queue", tab: "kyc", icon: ShieldCheck, desc: "UIDAI Aadhaar & PAN verification audit" },
    { label: "Audit & Ledger Reports", tab: "reports", icon: FileText, desc: "System transaction logs & exports" },
  ];

  const filtered = quickNav.filter(
    (item) =>
      item.label.toLowerCase().includes(cmdSearchQuery.toLowerCase()) ||
      item.desc.toLowerCase().includes(cmdSearchQuery.toLowerCase())
  );

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
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-400 bg-slate-100 border border-slate-200 rounded">
            ESC
          </kbd>
          <button
            onClick={() => setShowCommandModal(false)}
            className="text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
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
              {filtered.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.tab}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setShowCommandModal(false);
                    }}
                    className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-700 font-medium flex items-center justify-between transition-colors cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        <Icon className="w-4 h-4 text-black" />
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900 text-xs">{item.label}</div>
                        <div className="text-[11px] text-slate-400">{item.desc}</div>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
          <span>Tip: Press <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-white border border-slate-200 rounded text-[10px]">K</kbd> anywhere to open</span>
          <span>AquaPay Admin Console</span>
        </div>
      </div>
    </div>
  );
}

export default CommandSearchModal;