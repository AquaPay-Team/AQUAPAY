import React from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import PasswordUpdateForm from "@/features/auth/components/PasswordUpdateForm";

export function SecurityTab({ ownProfile, admin, profile, onOpenResetDialog }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-4">
        <div className="border-b border-slate-100 pb-4">
          <h3 className="text-sm font-bold text-slate-900">
            {admin && !ownProfile ? "Security & Reset" : "Password Update"}
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {admin && !ownProfile
              ? "Manage user credentials and session security"
              : "Update your account password to keep your terminal secure"}
          </p>
        </div>
        {!ownProfile && admin && Number(profile?.role_id) !== 1 && (
          <Button
            type="button"
            onClick={onOpenResetDialog}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            <KeyRound className="w-4 h-4 mr-1.5" /> Reset User Password
          </Button>
        )}
        {ownProfile && <PasswordUpdateForm compact />}
      </div>
    </div>
  );
}

export default SecurityTab;
