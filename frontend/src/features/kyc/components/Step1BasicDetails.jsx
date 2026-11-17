import React from "react";
import { User, Mail, Smartphone, MapPin, Briefcase, AlertCircle } from "lucide-react";

const fieldClass = "w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-700 focus:outline-none";

export function Step1BasicDetails({ formData, onChange, errors = {} }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-base font-semibold text-slate-900">Personal & Business Information</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Confirm your registered identity details and enter your primary commercial information.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[{
          key: "fullName", label: "Full Legal Name", Icon: User, value: formData.fullName,
        }, {
          key: "phone", label: "Registered Mobile Number", Icon: Smartphone, value: formData.phone,
        }, {
          key: "email", label: "Primary Email Address", Icon: Mail, value: formData.email,
        }].map(({ key, label, Icon, value }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">{label}</label>
            <div className="relative">
              <Icon className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={value || ""}
                readOnly
                aria-readonly="true"
                className={`${fieldClass} pl-10`}
              />
            </div>
            {errors[key] && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors[key]}</p>}
          </div>
        ))}

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            Business Constitution / Type <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <Briefcase className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
            <select
              value={formData.businessType || "Sole Proprietorship"}
              onChange={(e) => onChange("businessType", e.target.value)}
              className={`${fieldClass} pl-10 bg-white ${errors.businessType ? "border-rose-400" : "focus:border-blue-600 focus:ring-1 focus:ring-blue-600"}`}
            >
              <option value="Sole Proprietorship">Sole Proprietorship</option>
              <option value="Private Limited Company">Private Limited Company</option>
              <option value="Partnership / LLP">Partnership / LLP</option>
            </select>
          </div>
          {errors.businessType && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.businessType}</p>}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-slate-700 mb-1.5">
          Operating Commercial Address <span className="text-rose-500">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3.5 top-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            maxLength={255}
            value={formData.shopAddress || ""}
            onChange={(e) => onChange("shopAddress", e.target.value)}
            placeholder="Shop/Office number, building, street"
            className={`w-full bg-white border rounded-xl pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none transition ${errors.shopAddress ? "border-rose-400" : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"}`}
          />
        </div>
        {errors.shopAddress && <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{errors.shopAddress}</p>}
      </div>
    </div>
  );
}

export default Step1BasicDetails;
