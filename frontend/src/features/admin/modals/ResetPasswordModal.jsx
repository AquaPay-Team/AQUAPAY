import React, { useState } from "react";
import {
  KeyRound,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { resetSubordinatePassword } from "../services/adminApi";

export function ResetPasswordModal({ user, onClose, onSuccess }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  if (!user) return null;

  // Generate strong random password using crypto.getRandomValues
  const generateSecurePassword = () => {
    const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const lowercase = "abcdefghijkmnpqrstuvwxyz";
    const numbers = "23456789";
    const symbols = "!@#$%^&*";
    const all = uppercase + lowercase + numbers + symbols;

    const getRandomChar = (charset) => {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      return charset[arr[0] % charset.length];
    };

    let generated = [
      getRandomChar(uppercase),
      getRandomChar(lowercase),
      getRandomChar(numbers),
      getRandomChar(symbols),
    ];

    const targetLength = 12;
    for (let i = generated.length; i < targetLength; i++) {
      generated.push(getRandomChar(all));
    }

    // Shuffle using Fisher-Yates with crypto
    for (let i = generated.length - 1; i > 0; i--) {
      const arr = new Uint32Array(1);
      window.crypto.getRandomValues(arr);
      const j = arr[0] % (i + 1);
      [generated[i], generated[j]] = [generated[j], generated[i]];
    }

    const passwordStr = generated.join("");
    setNewPassword(passwordStr);
    setConfirmPassword(passwordStr);
    setShowPassword(true);
    setShowConfirmPassword(true);
    setErrorMessage("");
    toast.info("Generated a secure random 12-character temporary password.");
  };

  const handleCopyPassword = async () => {
    if (!newPassword) return;
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopied(true);
      toast.success("Temporary password copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy password");
    }
  };

  // Real-time strength metrics
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[^a-zA-Z0-9]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const strengthScore = [hasMinLength, hasLetter, hasNumber, hasSpecial].filter(Boolean).length;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    if (!newPassword || newPassword.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Password confirmation does not match.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await resetSubordinatePassword(user.id, {
        newPassword,
        confirmPassword,
      });

      toast.success(res?.message || `Password reset successfully for ${user.name}!`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Failed to reset password. Please check your permissions.";
      setErrorMessage(msg);
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <KeyRound className="w-5 h-5 text-black" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Reset User Password</h2>
              <p className="text-xs text-slate-400">
                Set a secure temporary password for this agent account
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target User Info Card */}
        <div className="px-5 pt-4">
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                <span>{user.name}</span>
                <span className="font-mono text-[10px] text-slate-400 bg-white border border-slate-200 px-1 rounded">
                  #{user.id}
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {user.mobile} • {user.email || "No email"}
              </div>
            </div>
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
              {user.role_name || user.role_slug || "Agent"}
            </span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-5 mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* New Password */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700">New Password</label>
              <button
                type="button"
                onClick={generateSecurePassword}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold flex items-center gap-1 cursor-pointer hover:underline"
              >
                <RefreshCw className="w-3 h-3" />
                Generate Secure
              </button>
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="Enter or generate temporary password"
                className="w-full pl-3 pr-16 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {newPassword && (
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                    title="Copy Password"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setErrorMessage("");
                }}
                placeholder="Re-enter password to confirm"
                className="w-full pl-3 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 font-mono"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
              >
                {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {/* Strength & Validation Indicators */}
          <div className="p-3 bg-slate-50/60 rounded-xl border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Password Strength:</span>
              <span
                className={`font-bold ${
                  strengthScore <= 1
                    ? "text-rose-600"
                    : strengthScore <= 3
                    ? "text-amber-600"
                    : "text-emerald-600"
                }`}
              >
                {strengthScore <= 1 ? "Weak" : strengthScore <= 3 ? "Moderate" : "Strong"}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1 h-1 bg-slate-200 rounded-full overflow-hidden">
              <div className={`h-full ${strengthScore >= 1 ? (strengthScore === 1 ? "bg-rose-500" : "bg-emerald-500") : "bg-transparent"}`} />
              <div className={`h-full ${strengthScore >= 2 ? "bg-emerald-500" : "bg-transparent"}`} />
              <div className={`h-full ${strengthScore >= 3 ? "bg-emerald-500" : "bg-transparent"}`} />
              <div className={`h-full ${strengthScore >= 4 ? "bg-emerald-500" : "bg-transparent"}`} />
            </div>
            <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-slate-500">
              <div className="flex items-center gap-1">
                {hasMinLength ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" />}
                <span>8+ Characters</span>
              </div>
              <div className="flex items-center gap-1">
                {passwordsMatch ? <Check className="w-3 h-3 text-emerald-600" /> : <span className="w-3 h-3 rounded-full bg-slate-200 inline-block" />}
                <span>Passwords Match</span>
              </div>
            </div>
          </div>

          {/* Modal Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !hasMinLength || !passwordsMatch}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Lock className="w-3.5 h-3.5" />
                  <span>Confirm Password Reset</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ResetPasswordModal;