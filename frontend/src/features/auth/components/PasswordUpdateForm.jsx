import React, { useState } from "react";
import { KeyRound } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { changePassword } from "../../../api/auth.api";
import { resetBackendUserPassword } from "../../users/api/usersApi";

export function PasswordUpdateForm({ targetUserId, onSuccess, compact = false }) {
  const isAdminReset = Boolean(targetUserId);
  const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");

  const setField = (field, value) => setValues((previous) => ({ ...previous, [field]: value }));
  const submit = async (event) => {
    event.preventDefault();
    setMessage("");
    if (values.newPassword.length < 8 || new TextEncoder().encode(values.newPassword).length > 72) {
      setMessage("New password must be 8 or more characters and no more than 72 bytes.");
      return;
    }
    if (values.newPassword !== values.confirmPassword) {
      setMessage("New password and confirmation do not match.");
      return;
    }
    setIsSaving(true);
    try {
      if (isAdminReset) {
        await resetBackendUserPassword(targetUserId, values);
        toast.success("User password reset successfully.");
      } else {
        await changePassword(values);
        toast.success("Your password was changed successfully.");
      }
      setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMessage(isAdminReset ? "Password reset successfully." : "Password changed successfully.");
      onSuccess?.();
    } catch (error) {
      const apiMessage = error?.response?.data?.message;
      setMessage(apiMessage || (isAdminReset ? "Could not reset this password." : "Could not change the password."));
      toast.error(apiMessage || "Password update failed.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className={`${compact ? "space-y-4" : "bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-4"}`}>
      <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-blue-600" />
        {isAdminReset ? "Reset User Password" : "Change Password"}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {!isAdminReset && <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input id="current-password" type="password" autoComplete="current-password" value={values.currentPassword} onChange={(e) => setField("currentPassword", e.target.value)} required />
        </div>}
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" autoComplete="new-password" value={values.newPassword} onChange={(e) => setField("newPassword", e.target.value)} required minLength={8} maxLength={72} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input id="confirm-password" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(e) => setField("confirmPassword", e.target.value)} required minLength={8} maxLength={72} />
        </div>
      </div>
      {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
      <Button type="submit" disabled={isSaving} className="bg-blue-600 text-white hover:bg-blue-700">
        {isSaving ? "Saving…" : isAdminReset ? "Reset Password" : "Change Password"}
      </Button>
    </form>
  );
}

export default PasswordUpdateForm;
