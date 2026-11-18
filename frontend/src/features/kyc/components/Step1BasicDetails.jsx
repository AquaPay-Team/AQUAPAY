import React from "react";
import {
  User,
  Smartphone,
  Mail,
  MapPin,
  Briefcase,
  AlertCircle,
  Building,
  CheckCircle2,
  Lock,
  Store,
} from "lucide-react";

/**
 * Step 1 – Basic Details (Personal & Business Information)
 *
 * Rules:
 * 1. Date of Birth (DOB) is completely removed.
 * 2. User profile values already entered during user creation (Name, Mobile,
 *    Email, Shop Name, City, State, PIN Code, Address) are pre-filled and displayed
 *    cleanly as verified account data to prevent duplicate re-entry.
 * 3. Business Constitution / Type is selectable (Sole Proprietorship, Private Limited Company, Partnership / LLP).
 * 4. Operating Commercial Address (shopAddress) can be confirmed or edited if different.
 */
export function Step1BasicDetails({ formData = {}, onChange, errors = {}, isAadhaarVerified = false }) {
  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const fullName = formData.fullName || currentUser.name || "N/A";
  const mobile = formData.phone || currentUser.mobile || "N/A";
  const email = formData.email || currentUser.email || "N/A";
  const shopName = formData.shopname || currentUser.shopname || "AquaPay Retail Outlet";
  const city = formData.city || currentUser.city || "";
  const state = formData.state || currentUser.state || "";
  const pincode = formData.pincode || currentUser.pincode || "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Personal & Business Information</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Verify your registered profile details and select your commercial business constitution.
        </p>
      </div>

      {/* Verified Account Details (Pre-filled from User Creation) */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Registered Profile Details
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
            <Lock className="w-3 h-3 text-emerald-600" /> Verified Account
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-1 text-xs">
          {/* Full Name */}
          <div className={`bg-white border rounded-xl p-3 ${errors.fullName ? "border-rose-400 bg-rose-50/20" : "border-slate-200/80"}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-slate-400 text-[11px] flex items-center gap-1">
                <User className="w-3 h-3 text-slate-400" /> Full Legal Name
              </span>
              {isAadhaarVerified && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Aadhaar Verified
                </span>
              )}
            </div>
            <span className="font-semibold text-slate-900 text-sm tracking-wide">{fullName}</span>
            {errors.fullName && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.fullName}</span>
              </p>
            )}
          </div>

          {/* Registered Mobile */}
          <div className={`bg-white border rounded-xl p-3 ${errors.phone ? "border-rose-400 bg-rose-50/20" : "border-slate-200/80"}`}>
            <span className="text-slate-400 block text-[11px] mb-1 flex items-center gap-1">
              <Smartphone className="w-3 h-3 text-slate-400" /> Registered Mobile
            </span>
            <span className="font-semibold text-slate-900 text-sm font-mono">{mobile}</span>
            {errors.phone && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.phone}</span>
              </p>
            )}
          </div>

          {/* Registered Email */}
          <div className={`bg-white border rounded-xl p-3 ${errors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200/80"}`}>
            <span className="text-slate-400 block text-[11px] mb-1 flex items-center gap-1">
              <Mail className="w-3 h-3 text-slate-400" /> Primary Email
            </span>
            <span className="font-semibold text-slate-900 text-sm truncate block">{email}</span>
            {errors.email && (
              <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle className="w-3 h-3 shrink-0" />
                <span>{errors.email}</span>
              </p>
            )}
          </div>

          {/* Shop / Business Name */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-1 flex items-center gap-1">
              <Store className="w-3 h-3 text-slate-400" /> Shop / Business Name
            </span>
            <span className="font-semibold text-slate-900">{shopName}</span>
          </div>

          {/* City / State */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-1 flex items-center gap-1">
              <Building className="w-3 h-3 text-slate-400" /> City / District & State
            </span>
            <span className="font-semibold text-slate-900">
              {city && state ? `${city}, ${state}` : city || state || "Registered Location"}
            </span>
          </div>

          {/* PIN Code */}
          <div className="bg-white border border-slate-200/80 rounded-xl p-3">
            <span className="text-slate-400 block text-[11px] mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> Postal PIN Code
            </span>
            <span className="font-semibold text-slate-900 font-mono">{pincode || "Registered"}</span>
          </div>
        </div>
      </div>

      {/* KYC Required Commercial Details */}
      <div className="space-y-4 pt-1">
        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
          Commercial KYC Classification
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Business Type Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Business Constitution / Type <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Briefcase className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <select
                value={formData.businessType || "Sole Proprietorship"}
                onChange={(e) => onChange("businessType", e.target.value)}
                className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition cursor-pointer ${
                  errors.businessType
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                }`}
              >
                <option value="Sole Proprietorship">Sole Proprietorship</option>
                <option value="Private Limited Company">Private Limited Company</option>
                <option value="Partnership / LLP">Partnership / LLP</option>
              </select>
            </div>
            {errors.businessType && (
              <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.businessType}</span>
              </p>
            )}
          </div>

          {/* Operating Commercial Address */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Operating Commercial Address <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={formData.shopAddress || formData.address || currentUser?.address || ""}
                onChange={(e) => onChange("shopAddress", e.target.value)}
                placeholder="Shop/Office number, building, market, street"
                className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                  errors.shopAddress
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                }`}
              />
            </div>
            {errors.shopAddress && (
              <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{errors.shopAddress}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Step1BasicDetails;
