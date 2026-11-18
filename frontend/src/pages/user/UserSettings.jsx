import React, { useState } from "react";
import {
  Settings,
  Lock,
  Building2,
  Bell,
  ShieldCheck,
  Check,
  KeyRound
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function UserSettings() {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [instantSettlement, setInstantSettlement] = useState(true);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          Terminal & Account Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          Manage your security preferences, bank settlement routing, and terminal notifications
        </p>
      </div>

      <div className="space-y-4">
        {/* Security Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Lock className="w-4 h-4 text-blue-600" /> Security & Password
          </h2>
          <p className="text-xs text-slate-500">
            Keep your merchant terminal secure with strong authentication credentials.
          </p>
          <div className="pt-2">
            <Link
              to="/forgot-password"
              className="inline-flex items-center gap-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-semibold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5" />
              Request Password Reset OTP
            </Link>
          </div>
        </div>

        {/* Settlement Box */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-600" /> Banking Settlement Preferences
          </h2>
          <div className="flex items-center justify-between text-xs py-2 border-b border-slate-100">
            <div>
              <span className="font-semibold text-slate-800 block">Auto Bank Settlement (IMPS)</span>
              <span className="text-slate-400">Automatically transfer AEPS cash-out funds to verified bank at 11:30 PM daily.</span>
            </div>
            <button
              onClick={() => {
                setInstantSettlement(!instantSettlement);
                toast.success("Auto-settlement preference updated");
              }}
              className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                instantSettlement ? "bg-emerald-600" : "bg-slate-300"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  instantSettlement ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs py-2">
            <div>
              <span className="font-semibold text-slate-800 block">SMS & Email Transaction Alerts</span>
              <span className="text-slate-400">Receive instant alerts for transactions above ₹ 1,000.</span>
            </div>
            <button
              onClick={() => {
                setNotificationsEnabled(!notificationsEnabled);
                toast.success("Notification preferences updated");
              }}
              className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                notificationsEnabled ? "bg-blue-600" : "bg-slate-300"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  notificationsEnabled ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
