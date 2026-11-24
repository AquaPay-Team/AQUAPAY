import React from "react";

export function WalletLockTab() {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
      <div className="border-b border-slate-100 pb-4">
        <h3 className="text-sm font-bold text-slate-900">Wallet Controls &amp; Limits</h3>
        <p className="text-xs text-slate-400 mt-0.5">Control transaction freeze and daily balance limits</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400">Payout Status</span>
          <p className="text-sm font-bold text-emerald-700">Unlocked / Normal</p>
        </div>
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1">
          <span className="text-slate-400">Max Daily Limit</span>
          <p className="text-sm font-bold text-slate-800">₹2,00,000</p>
        </div>
      </div>
    </div>
  );
}

export default WalletLockTab;
