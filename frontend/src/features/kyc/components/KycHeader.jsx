import React from "react";
import { LogOut } from "lucide-react";

export function KycHeader({ onLogout }) {
  return (
    <header className="sticky top-0 z-40 bg-white border-b border-slate-200 px-4 sm:px-8 py-3 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Complete Your KYC
        </h1>
      </div>

      <div className="flex items-center space-x-3">
        <button
          type="button"
          onClick={onLogout}
          className="w-8 h-8 rounded-md bg-[#ff4d4f] hover:bg-[#ff3335] text-white flex items-center justify-center transition shadow-xs cursor-pointer"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4 stroke-[2.2]" />
        </button>
      </div>
    </header>
  );
}

export default KycHeader;