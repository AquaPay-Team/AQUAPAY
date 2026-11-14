import React from "react";
import {
  User,
  Mail,
  Phone,
  Store,
  MapPin,
  ShieldCheck,
  Building,
  CheckCircle2,
  Calendar,
  Lock
} from "lucide-react";
import { getRoleMeta } from "../../constants/roles";

export default function UserProfile() {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Partner",
    slug: "RT",
  };

  const kycStatus = String(currentUser.kyc?.status || "pending").toLowerCase();
  const isKycVerified = ["approved", "completed", "verified", "submitted"].includes(kycStatus);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
          My Account Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
          View your authenticated AquaPay partner credentials and business profile
        </p>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-sm">
              {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  {currentUser.name || "AquaPay Member"}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-full">
                  {currentUser.status || "Active"}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">
                Partner ID: #{currentUser.id} • Role: {roleMeta.name}
              </p>
            </div>
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            {isKycVerified ? "KYC Completed & Underwritten" : "KYC Pending Verification"}
          </div>
        </div>

        {/* Detailed Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          <div className="space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" /> Email Address
            </span>
            <span className="font-semibold text-slate-800 text-sm block">
              {currentUser.email || "N/A"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" /> Mobile Number
            </span>
            <span className="font-semibold text-slate-800 text-sm block">
              {currentUser.mobile || "N/A"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-slate-400" /> Registered Commercial Premise / Shop
            </span>
            <span className="font-semibold text-slate-800 block">
              {currentUser.shopname || "AquaPay Digital Center"}
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" /> City & State
            </span>
            <span className="font-semibold text-slate-800 block">
              {currentUser.city || "N/A"}, {currentUser.state || ""} {currentUser.pincode ? `(${currentUser.pincode})` : ""}
            </span>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <span className="text-slate-400 font-medium flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-slate-400" /> Outlet Premise Address
            </span>
            <span className="font-semibold text-slate-800 block">
              {currentUser.address || "AquaPay Certified Commercial Terminal"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
