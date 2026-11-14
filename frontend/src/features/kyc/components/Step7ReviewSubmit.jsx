import React from "react";
import { CheckCircle2, ShieldCheck, FileText, Building2, User, Camera } from "lucide-react";

export function Step7ReviewSubmit({ formData, onEditStep, onSubmitKyc, isSubmitting }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Application Review & Final Submission</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Please review your submitted information before final transmission to our compliance underwriting team.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Personal & Business Info */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <span className="flex items-center gap-1.5 text-blue-900">
              <User className="w-3.5 h-3.5 text-blue-600" />
              Personal & Business Information
            </span>
            <button
              type="button"
              onClick={() => onEditStep(1)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
            >
              Modify
            </button>
          </div>
          <div className="text-xs space-y-1.5 text-slate-700">
            <p><span className="text-slate-500">Legal Name:</span> <strong className="text-slate-900">{formData.fullName}</strong></p>
            <p><span className="text-slate-500">Business Type:</span> {formData.businessType || "Retail Merchant"}</p>
            <p><span className="text-slate-500">Date of Birth:</span> {formData.dob || "—"}</p>
            <p><span className="text-slate-500">Mobile Number:</span> +91 {formData.phone}</p>
            <p><span className="text-slate-500">Email Address:</span> {formData.email}</p>
            <p><span className="text-slate-500">Operating Address:</span> {formData.shopAddress || formData.address}, {formData.city} - {formData.pincode} ({formData.state})</p>
          </div>
        </div>

        {/* Identity IDs */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <span className="flex items-center gap-1.5 text-blue-900">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              Identity & Tax Records
            </span>
            <button
              type="button"
              onClick={() => onEditStep(2)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
            >
              Modify
            </button>
          </div>
          <div className="text-xs space-y-1.5 text-slate-700">
            <p><span className="text-slate-500">Aadhaar Identifier:</span> <span className="font-mono">{formData.aadhaarNumber || "Provided via e-KYC"}</span></p>
            <p><span className="text-slate-500">Permanent Account Number (PAN):</span> <span className="font-mono font-semibold text-slate-900">{formData.panNumber || "—"}</span></p>
            <div className="flex items-center gap-1.5 text-emerald-800 font-medium pt-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Identity Verified via UIDAI / Income Tax Records</span>
            </div>
          </div>
        </div>

        {/* Bank Account */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <span className="flex items-center gap-1.5 text-blue-900">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              Settlement Bank Account
            </span>
            <button
              type="button"
              onClick={() => onEditStep(4)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
            >
              Modify
            </button>
          </div>
          <div className="text-xs space-y-1.5 text-slate-700">
            <p><span className="text-slate-500">Bank Name:</span> <strong className="text-slate-900">{formData.bankName || "—"}</strong></p>
            <p><span className="text-slate-500">Account Number:</span> <span className="font-mono">{formData.accountNumber ? `••••••••${formData.accountNumber.slice(-4)}` : "—"}</span></p>
            <p><span className="text-slate-500">IFSC Code:</span> <span className="font-mono">{formData.ifscCode || "—"}</span></p>
            <p><span className="text-slate-500">Account Type:</span> {formData.accountType} Account</p>
          </div>
        </div>

        {/* Documents & Media */}
        <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl space-y-2.5">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-800 border-b border-slate-200 pb-2">
            <span className="flex items-center gap-1.5 text-blue-900">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              Verification Documents & Media
            </span>
            <button
              type="button"
              onClick={() => onEditStep(5)}
              className="text-xs text-blue-600 hover:text-blue-700 font-medium hover:underline cursor-pointer"
            >
              Modify
            </button>
          </div>
          <div className="text-xs space-y-1.5 text-slate-700">
            <p><span className="text-slate-500">Signatory Photo:</span> {formData.selfieFile ? "Attached" : "Pending"}</p>
            <p><span className="text-slate-500">Consent Video:</span> {formData.videoFile ? "Attached" : "Pending"}</p>
            <p><span className="text-slate-500">Shop Premise Photo:</span> {formData.shopPhotoFile ? "Attached" : "Pending"}</p>
            <p><span className="text-slate-500">Merchant Agreement:</span> <strong className="text-emerald-700">{formData.agreedTerms ? "Executed & Accepted" : "Pending"}</strong></p>
          </div>
        </div>
      </div>

      {/* Compliance Confirmation */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 leading-relaxed">
        <p>
          <strong>Merchant Undertaking:</strong> By submitting this KYC application, you confirm that all information and documents furnished are true, authentic, and complete. Any discrepancy or misrepresentation may lead to rejection or account suspension under applicable banking and payment regulations.
        </p>
      </div>
    </div>
  );
}

export default Step7ReviewSubmit;
