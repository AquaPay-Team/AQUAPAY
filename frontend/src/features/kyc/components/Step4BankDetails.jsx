import React from "react";
import { Check, Building2, Info, AlertCircle, ShieldCheck } from "lucide-react";

export function Step4BankDetails({ formData, onChange, errors = {}, isVerified = false }) {
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

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
        {/* Account Holder Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Beneficiary / Account Holder Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isVerified}
            value={formData.accountHolderName || formData.fullName || ""}
            onChange={(e) => onChange("accountHolderName", e.target.value)}
            placeholder="As printed on bank passbook or statement"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:bg-slate-50 disabled:text-slate-600"
          />
          {errors.accountHolderName && (
            <p className="text-xs text-rose-500 mt-1 font-medium">{errors.accountHolderName}</p>
          )}
        </div>

        {/* Bank Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Bank Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isVerified}
            value={formData.bankName || ""}
            onChange={(e) => onChange("bankName", e.target.value)}
            placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:bg-slate-50 disabled:text-slate-600"
          />
          {errors.bankName && (
            <p className="text-xs text-rose-500 mt-1 font-medium">{errors.bankName}</p>
          )}
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Bank Account Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isVerified}
            maxLength={18}
            value={formData.accountNumber || ""}
            onChange={(e) => handleAccountChange("accountNumber", e)}
            placeholder="9 to 18-digit account number"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:bg-slate-50 disabled:text-slate-600"
          />
          {errors.accountNumber && (
            <p className="text-xs text-rose-500 mt-1 font-medium">{errors.accountNumber}</p>
          )}
        </div>

        {/* Confirm Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Confirm Account Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isVerified}
            maxLength={18}
            value={formData.confirmAccountNumber || ""}
            onChange={(e) => handleAccountChange("confirmAccountNumber", e)}
            placeholder="Re-enter account number"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:bg-slate-50 disabled:text-slate-600"
          />
          {errors.confirmAccountNumber && (
            <p className="text-xs text-rose-500 mt-1 font-medium">{errors.confirmAccountNumber}</p>
          )}
        </div>

        {/* IFSC Code */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            IFSC Code <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            disabled={isVerified}
            maxLength={11}
            value={formData.ifscCode || ""}
            onChange={handleIfscChange}
            placeholder="e.g. SBIN0001234 (11 characters)"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 uppercase font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition disabled:bg-slate-50 disabled:text-slate-600"
          />
          {errors.ifscCode && (
            <p className="text-xs text-rose-500 mt-1 font-medium">{errors.ifscCode}</p>
          )}
        </div>

        {/* Account Type */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Account Type <span className="text-rose-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-2">
            {["Current", "Savings"].map((type) => (
              <button
                key={type}
                type="button"
                disabled={isVerified}
                onClick={() => onChange("accountType", type)}
                className={`py-2.5 px-3.5 rounded-xl border text-xs font-medium flex items-center justify-between transition cursor-pointer ${
                  formData.accountType === type
                    ? "bg-blue-50 border-blue-600 text-blue-900 font-semibold shadow-xs"
                    : "bg-white border-slate-300 text-slate-700 hover:border-slate-400"
                }`}
              >
                <span>{type} Account</span>
                {formData.accountType === type && <Check className="w-3.5 h-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
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
            Bank Account Notice: Your IFSC code will be validated against the Reserve Bank of India bank directory. Beneficiary name must match your legal business or proprietor registration.
          </span>
        </div>
      )}
    </div>
  );
}

export default Step4BankDetails;
