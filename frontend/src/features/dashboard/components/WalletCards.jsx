import React from "react";
import { ArrowUpRight, Wallet, Landmark, Smartphone } from "lucide-react";

export function WalletCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
      {/* Main Wallet */}
      <div className="relative overflow-hidden bg-blue-50/60 rounded-2xl p-6 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
        <Wallet
          className="absolute -right-3 -bottom-3 w-24 h-24 text-blue-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
          strokeWidth={1}
        />
        <span className="text-xs font-semibold text-slate-500 block">Main Wallet</span>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-blue-100 text-blue-600">
            <ArrowUpRight className="w-3 h-3 text-black" />
            59.3%
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          You made an extra <span className="text-blue-500 font-medium">35k</span> this year
        </p>
      </div>

      {/* Settlement Wallet */}
      <div className="relative overflow-hidden bg-amber-50/60 rounded-2xl p-6 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
        <Landmark
          className="absolute -right-3 -bottom-3 w-24 h-24 text-amber-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
          strokeWidth={1}
        />
        <span className="text-xs font-semibold text-slate-500 block">Settlement Wallet</span>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-amber-100 text-amber-600">
            <ArrowUpRight className="w-3 h-3 text-black" />
            27.4%
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          You made an extra <span className="text-amber-500 font-medium">1,943</span> this year
        </p>
      </div>

      {/* UPI Wallet */}
      <div className="relative overflow-hidden bg-purple-50/60 rounded-2xl p-6 border border-purple-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all group">
        <Smartphone
          className="absolute -right-3 -bottom-3 w-24 h-24 text-purple-200/40 rotate-12 pointer-events-none group-hover:scale-110 transition-transform"
          strokeWidth={1}
        />
        <span className="text-xs font-semibold text-slate-500 block">UPI Wallet</span>
        <div className="flex items-center gap-3 mt-3">
          <span className="text-3xl font-bold text-slate-900 tracking-tight">₹ 0.00</span>
          <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-xs font-semibold bg-purple-100 text-purple-600">
            <ArrowUpRight className="w-3 h-3 text-black" />
            70.5%
          </span>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          You made an extra <span className="text-purple-500 font-medium">8.9k</span> this year
        </p>
      </div>
    </div>
  );
}

export default WalletCards;
