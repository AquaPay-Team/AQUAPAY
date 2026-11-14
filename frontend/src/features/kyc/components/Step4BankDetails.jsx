import React from "react";
import { Check, Building2, Info } from "lucide-react";

export function Step4BankDetails({ formData, onChange }) {
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
            value={formData.accountHolderName || formData.fullName || ""}
            onChange={(e) => onChange("accountHolderName", e.target.value)}
            placeholder="As printed on bank passbook or statement"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
        </div>

        {/* Bank Name */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Bank Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.bankName || ""}
            onChange={(e) => onChange("bankName", e.target.value)}
            placeholder="e.g. State Bank of India, HDFC Bank, ICICI Bank"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
        </div>

        {/* Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Bank Account Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.accountNumber || ""}
            onChange={(e) => onChange("accountNumber", e.target.value.replace(/\D/g, ""))}
            placeholder="Enter account number"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
        </div>

        {/* Confirm Account Number */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Confirm Account Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.confirmAccountNumber || ""}
            onChange={(e) => onChange("confirmAccountNumber", e.target.value.replace(/\D/g, ""))}
            placeholder="Re-enter account number"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
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
            onChange={(e) => onChange("ifscCode", e.target.value.toUpperCase().slice(0, 11))}
            placeholder="e.g. SBIN0001234"
            className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 uppercase font-mono tracking-wider focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition"
          />
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

      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 text-xs text-slate-600">
        <Info className="w-4 h-4 shrink-0 text-slate-400 mt-0.5" />
        <span>
          Bank Verification Notice: A nominal ₹1 penny-drop validation will be performed to confirm that the beneficiary name on the bank records matches your verified business or proprietor name.
        </span>
      </div>
    </div>
  );
}

export default Step4BankDetails;
