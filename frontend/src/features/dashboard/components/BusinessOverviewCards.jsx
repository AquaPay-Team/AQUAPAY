import React from "react";
import { Calendar, BarChart2, BarChart3, TrendingUp } from "lucide-react";

export function BusinessOverviewCards() {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-slate-900">Business Overview</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Today Business */}
        <div className="bg-emerald-50/60 rounded-2xl p-5 border border-emerald-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Today Business</h4>
              <p className="text-[11px] text-slate-400">Today's Collection</p>
            </div>
          </div>
          <div className="flex items-end gap-1 h-11 mb-3">
            {[20, 35, 15, 45, 30, 50, 10].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{ height: `${h}%`, backgroundColor: i === 6 ? "#10b981" : "#d1fae5" }}
              />
            ))}
          </div>
          <span className="text-xl font-bold text-emerald-600">₹0</span>
        </div>

        {/* This Month */}
        <div className="bg-blue-50/60 rounded-2xl p-5 border border-blue-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <BarChart2 className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">This Month</h4>
              <p className="text-[11px] text-slate-400">Current Month Business</p>
            </div>
          </div>
          <div className="flex items-end gap-1 h-11 mb-3">
            {[30, 55, 40, 60, 45].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{ height: `${h}%`, backgroundColor: i === 4 ? "#3b82f6" : "#dbeafe" }}
              />
            ))}
          </div>
          <span className="text-xl font-bold text-blue-600">₹0</span>
        </div>

        {/* Last Month */}
        <div className="bg-amber-50/60 rounded-2xl p-5 border border-amber-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">Last Month</h4>
              <p className="text-[11px] text-slate-400">Previous Month Business</p>
            </div>
          </div>
          <div className="flex items-end gap-1 h-11 mb-3">
            {[45, 35, 60, 50, 40].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{ height: `${h}%`, backgroundColor: i === 2 ? "#f59e0b" : "#fef3c7" }}
              />
            ))}
          </div>
          <span className="text-xl font-bold text-amber-600">₹0</span>
        </div>

        {/* This Year */}
        <div className="bg-rose-50/60 rounded-2xl p-5 border border-rose-100/80 shadow-2xs hover:shadow-md hover:-translate-y-0.5 transition-all">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-black" strokeWidth={2} />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">This Year</h4>
              <p className="text-[11px] text-slate-400">Yearly Business Growth</p>
            </div>
          </div>
          <div className="flex items-end gap-1 h-11 mb-3">
            {[25, 40, 55, 70].map((h, i) => (
              <div
                key={i}
                className="flex-1 rounded-t transition-all"
                style={{ height: `${h}%`, backgroundColor: i === 3 ? "#f43f5e" : "#fecdd3" }}
              />
            ))}
          </div>
          <span className="text-xl font-bold text-rose-600">₹0</span>
        </div>
      </div>
    </div>
  );
}

export default BusinessOverviewCards;
