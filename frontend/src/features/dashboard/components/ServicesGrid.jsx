import React from "react";
import { Send, CreditCard, QrCode, Zap, MoreHorizontal } from "lucide-react";

export function ServicesGrid({ onServiceClick = () => {} }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-900">Services</h2>
        <button
          type="button"
          className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition cursor-pointer"
          title="Service options"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {/* Service 1: Payout */}
        <div
          onClick={() => onServiceClick("Payout")}
          className="bg-blue-50/50 border border-blue-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Payout</h3>
            <p className="text-xs text-slate-400 mt-1.5">Instant Transfer</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-blue-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Send className="w-6 h-6 text-black" strokeWidth={2} />
          </div>
        </div>

        {/* Service 2: Credit Card 2 */}
        <div
          onClick={() => onServiceClick("Credit Card 2")}
          className="bg-rose-50/50 border border-rose-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Credit Card 2</h3>
            <p className="text-xs text-slate-400 mt-1.5">Bill Payments</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-rose-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
            <CreditCard className="w-6 h-6 text-black" strokeWidth={2} />
          </div>
        </div>

        {/* Service 3: Rupay UPI */}
        <div
          onClick={() => onServiceClick("Rupay UPI")}
          className="bg-amber-50/50 border border-amber-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Rupay UPI</h3>
            <p className="text-xs text-slate-400 mt-1.5">UPI Collection</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-amber-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
            <QrCode className="w-6 h-6 text-black" strokeWidth={2} />
          </div>
        </div>

        {/* Service 4: Add Money */}
        <div
          onClick={() => onServiceClick("Add Money")}
          className="bg-purple-50/50 border border-purple-100/90 rounded-2xl p-6 flex items-center justify-between shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer group"
        >
          <div>
            <h3 className="text-base font-bold text-slate-900">Add Money</h3>
            <p className="text-xs text-slate-400 mt-1.5">Money Collection</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-purple-100/80 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Zap className="w-6 h-6 text-black" strokeWidth={2} />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ServicesGrid;
