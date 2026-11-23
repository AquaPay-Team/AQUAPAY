import React from "react";
import { CheckCircle2, ShieldCheck, Eye, EyeOff, Copy, Check } from "lucide-react";

export function AgentCredentialSuccess({
  createdAgent,
  showPassword,
  setShowPassword,
  handleCopyPassword,
  copied,
  handleClose,
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
        <div className="flex items-center gap-2 text-emerald-800 font-semibold text-sm">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Agent Onboarded Successfully</span>
        </div>
        <div className="text-xs text-slate-700 grid grid-cols-2 gap-2 pt-1 border-t border-emerald-100">
          <div>
            <span className="text-slate-500 block text-[11px]">Full Name</span>
            <span className="font-semibold text-slate-900">{createdAgent.name}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Email</span>
            <span className="font-mono text-slate-900">{createdAgent.email}</span>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Mobile</span>
            <span className="font-mono text-slate-900">{createdAgent.mobile}</span>
          </div>
        </div>
      </div>

      {/* Temporary Password Handoff Box */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-700">Initial Temporary Password</span>
          <span className="text-[11px] text-amber-600 font-medium">Handoff to agent</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type={showPassword ? "text" : "password"}
            readOnly
            value={createdAgent.tempPassword}
            className="flex-1 bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-semibold text-slate-900 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="p-2 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg bg-white hover:bg-slate-50 transition-colors"
            title={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopyPassword}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500 flex items-center gap-1 mt-1">
          <ShieldCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Please share this password with the agent. It is cleared once you close this modal.</span>
        </p>
      </div>

      <button
        type="button"
        onClick={handleClose}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer"
      >
        Done & Close
      </button>
    </div>
  );
}

export default AgentCredentialSuccess;
