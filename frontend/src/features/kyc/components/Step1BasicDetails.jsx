import React from "react";
import { User, Calendar, Smartphone, Mail, MapPin, Briefcase, AlertCircle } from "lucide-react";

export function Step1BasicDetails({ formData, onChange, errors = {} }) {
  // Today's date in YYYY-MM-DD for restricting future dates in HTML5 datepicker
  const maxDate = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Personal & Business Information</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Please enter your legal name and primary commercial details as registered on your official tax and identity records.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Full Legal Name <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <User className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={formData.fullName || ""}
              onChange={(e) => onChange("fullName", e.target.value)}
              placeholder="As printed on PAN / Aadhaar card"
              className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                errors.fullName
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            />
          </div>
          {errors.fullName && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.fullName}</span>
            </p>
          )}
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Date of Birth <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="date"
              max={maxDate}
              value={formData.dob || ""}
              onChange={(e) => onChange("dob", e.target.value)}
              className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition ${
                errors.dob
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            />
          </div>
          {errors.dob && (
            <p className="text-xs text-rose-500 mt-1.5 font-medium flex items-center gap-1.5 bg-rose-50/50 p-1.5 rounded-lg border border-rose-100">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span className="text-rose-700">{errors.dob}</span>
            </p>
          )}
        </div>

        {/* Mobile Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Registered Mobile Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Smartphone className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              maxLength={10}
              value={formData.phone || ""}
              onChange={(e) => onChange("phone", e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="10-digit mobile number"
              className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                errors.phone
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            />
          </div>
          {errors.phone && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.phone}</span>
            </p>
          )}
        </div>

        {/* Email */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Primary Email Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="email"
              value={formData.email || ""}
              onChange={(e) => onChange("email", e.target.value)}
              placeholder="e.g. merchant@example.com"
              className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${
                errors.email
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.email}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Business Type */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Business Constitution / Type <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <select
              value={formData.businessType || "Retail Merchant"}
              onChange={(e) => onChange("businessType", e.target.value)}
              className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition ${
                errors.businessType
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            >
              <option value="Retail Merchant">Retail Merchant / Kirana Store</option>
              <option value="Wholesaler">Wholesaler / Distributor</option>
              <option value="Water Utility Provider">Water Utility Provider / Tanker Service</option>
              <option value="Individual Business">Sole Proprietorship</option>
              <option value="Private Limited">Private Limited Company</option>
              <option value="Partnership">Partnership / LLP</option>
            </select>
          </div>
          {errors.businessType && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.businessType}</span>
            </p>
          )}
        </div>

        {/* Shop Address */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Operating Commercial Address <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={formData.shopAddress || formData.address || ""}
              onChange={(e) => onChange("shopAddress", e.target.value)}
              placeholder="Shop/Office number, building, street"
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* City */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            City / District <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.city || ""}
            onChange={(e) => onChange("city", e.target.value)}
            placeholder="e.g. Surat, Mumbai"
            className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition ${
              errors.city
                ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            }`}
          />
          {errors.city && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.city}</span>
            </p>
          )}
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            State <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.state || ""}
            onChange={(e) => onChange("state", e.target.value)}
            placeholder="e.g. Gujarat, Maharashtra"
            className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition ${
              errors.state
                ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            }`}
          />
          {errors.state && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.state}</span>
            </p>
          )}
        </div>

        {/* Pincode */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            PIN Code <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            maxLength={6}
            value={formData.pincode || ""}
            onChange={(e) => onChange("pincode", e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="6-digit PIN"
            className={`w-full bg-white border rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none transition ${
              errors.pincode
                ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
            }`}
          />
          {errors.pincode && (
            <p className="text-xs text-rose-500 mt-1 font-medium flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{errors.pincode}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Step1BasicDetails;
