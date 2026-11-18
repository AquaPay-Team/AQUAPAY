import React, { useState } from "react";
import { Info, ShieldCheck, Eye, EyeOff } from "lucide-react";

export function Step4BankDetails({ formData, onChange, errors = {}, isVerified = false }) {
  const [showAccountNumber, setShowAccountNumber] = useState(false);
  const [showConfirmAccountNumber, setShowConfirmAccountNumber] = useState(false);

  const handleIfscChange = (e) => {
    const val = e.target.value.toUpperCase().slice(0, 11);
    onChange("ifscCode", val);
  };

  const handleAccountChange = (field, e) => {
    const val = e.target.value.replace(/\D/g, "").slice(0, 18);
    onChange(field, val);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Settlement Bank Account</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Specify the commercial or business savings bank account where AquaPay transaction settlements will be credited.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Bank Account Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showAccountNumber ? "text" : "password"}
              value={formData.accountNumber || ""}
              onChange={(e) => handleAccountChange("accountNumber", e)}
              placeholder="Enter account number"
              className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowAccountNumber((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
              title={showAccountNumber ? "Hide Account Number" : "Show Account Number"}
            >
              {showAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.accountNumber && (
            <p className="text-xs text-rose-500 mt-1">{errors.accountNumber}</p>
          )}
        </div>

        {/* Confirm Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Confirm Account Number <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showConfirmAccountNumber ? "text" : "password"}
              value={formData.confirmAccountNumber || ""}
              onChange={(e) => handleAccountChange("confirmAccountNumber", e)}
              placeholder="Re-enter account number"
              className="w-full bg-white border border-slate-300 rounded-xl pl-3.5 pr-11 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
            />
            <button
              type="button"
              onClick={() => setShowConfirmAccountNumber((prev) => !prev)}
              tabIndex={-1}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition cursor-pointer p-1"
              title={showConfirmAccountNumber ? "Hide Account Number" : "Show Account Number"}
            >
              {showConfirmAccountNumber ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.confirmAccountNumber && (
            <p className="text-xs text-rose-500 mt-1">{errors.confirmAccountNumber}</p>
          )}
        </div>

        {/* IFSC Code */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            IFSC Code <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            maxLength={11}
            value={formData.ifscCode || ""}
            onChange={handleIfscChange}
            placeholder="e.g. SBIN0001234"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 uppercase font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
          {errors.ifscCode && (
            <p className="text-xs text-rose-500 mt-1">{errors.ifscCode}</p>
          )}
        </div>
      </div>

      {isVerified ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3 text-xs text-emerald-800">
          <ShieldCheck className="w-5 h-5 shrink-0 text-emerald-600" />
          <span>
            Bank account details have been recorded and verified for commercial settlement.
          </span>
        </div>
      ) : (
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
          <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
          <span>
            Bank Account Notice: Your IFSC code and account details will be verified before settlements are enabled. Please ensure the account belongs to your business or proprietor.
          </span>
        </div>
      )}
    </div>
  );
}

export default Step4BankDetails;
