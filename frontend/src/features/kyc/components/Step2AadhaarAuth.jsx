import React, { useState } from "react";
import {
  Smartphone,
  CheckCircle2,
  ShieldCheck,
  Lock,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  ArrowRight,
} from "lucide-react";

/**
 * Step 2 – Aadhaar Identity Verification via Official DigiLocker / UIDAI
 *
 * Flow:
 * 1. User enters 12-digit Aadhaar number (or confirms consent).
 * 2. Clicks "Verify with DigiLocker / UIDAI" -> Opens the official UIDAI Meri Pehchaan window.
 * 3. User enters the real SMS OTP in that official government window.
 * 4. AquaPay automatically polls and detects verification (or user clicks "Check Verification Status").
 * 5. Shows green verified card and advances to Step 3 (PAN Verification).
 */
export function Step2AadhaarAuth({
  formData = {},
  onChange = () => {},
  onTriggerOtp = () => {},
  isInitiating = false,
  digilockerSessionActive = false,
  onCheckStatus = () => {},
  isCheckingStatus = false,
  aadhaarVerified = false,
  verifiedData = {},
  onResetSession = () => {},
}) {
  const [aadhaarError, setAadhaarError] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);

  const cleanAadhaar = String(formData.aadhaarNumber || "").replace(/\D/g, "");

  const handleAadhaarChange = (e) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 12);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, "$1 ");
    onChange("aadhaarNumber", formatted);

    if (raw.length > 0 && raw.length < 12) {
      setAadhaarError(`Entered ${raw.length} of 12 digits`);
    } else {
      setAadhaarError("");
    }
  };

  const handleStartVerification = () => {
    if (cleanAadhaar.length !== 12) {
      setAadhaarError("Please enter your complete 12-digit Aadhaar number.");
      return;
    }
    if (!consentGiven) {
      setAadhaarError("Please accept the UIDAI consent agreement to proceed.");
      return;
    }
    setAadhaarError("");
    onTriggerOtp();
  };

  /* ─────────────────────────────────────────────────────────────
     1. VERIFIED STATE
  ────────────────────────────────────────────────────────────── */
  if (aadhaarVerified) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center space-y-1.5 mb-4">
          <div className="w-12 h-12 bg-emerald-50 border border-emerald-200 rounded-2xl mx-auto flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">Aadhaar Identity Verified</h3>
          <p className="text-xs text-slate-500">
            Your identity has been authenticated with UIDAI via DigiLocker.
          </p>
        </div>

        <div className="p-6 bg-emerald-50/70 border border-emerald-300 rounded-2xl space-y-4 shadow-xs">
          <div className="flex items-center gap-2.5 text-emerald-900 font-semibold text-sm">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Aadhaar e-KYC Verified Successfully</span>
          </div>

          <div className="text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-emerald-200/70">
            <div>
              <span className="text-slate-500 block text-[11px] mb-0.5">Verified Legal Name</span>
              <span className="font-semibold text-slate-900 text-sm">
                {verifiedData?.verifiedName || formData.fullName || "Verified User"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] mb-0.5">Masked Aadhaar</span>
              <span className="font-mono font-semibold text-slate-900 text-sm">
                {verifiedData?.maskedIdentifier || `•••• •••• ${cleanAadhaar.slice(-4) || "XXXX"}`}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px] mb-0.5">Authentication Authority</span>
              <span className="text-emerald-700 font-semibold">UIDAI / Meri Pehchaan</span>
            </div>
          </div>

          <div className="pt-2 text-xs text-emerald-800 font-medium flex items-center gap-1.5">
            <span>✓ Ready for PAN Verification. Click "Continue to Step 3" below.</span>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Data processed in compliance with the Aadhaar Act, 2016 and RBI Digital KYC regulations.
          </span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     2. ACTIVE DIGILOCKER SESSION STATE (Waiting for OTP on Gov Window)
  ────────────────────────────────────────────────────────────── */
  if (digilockerSessionActive) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center space-y-1.5 mb-4">
          <div className="w-12 h-12 bg-gray-50 border border-blue-200 rounded-2xl mx-auto flex items-center justify-center">
            <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
          </div>
          <h3 className="text-base font-semibold text-slate-900">
            Government DigiLocker Authentication In Progress
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            UIDAI has dispatched a one-time password to your Aadhaar-registered mobile and email.
          </p>
        </div>

        <div className="p-6 bg-gray-50/70 border border-blue-100 rounded-2xl space-y-5 shadow-xs">
          {/* Step Guidance */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Enter OTP on the Government Portal Window
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Switch to the opened Meri Pehchaan / DigiLocker window. Enter the OTP
                  received on your mobile and click "Sign In".
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-gray-100 text-white-700 border border-black-200 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Automatic Verification Sync
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  As soon as you complete authentication in that window, AquaPay will automatically
                  detect it. You can also click "Check Verification Status" below.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <button
              type="button"
              onClick={onCheckStatus}
              disabled={isCheckingStatus}
              className="flex-1 flex items-center justify-center gap-2 bg-gray-400 hover:bg-gray-500 active:scale-[0.99] text-white text-xs font-semibold px-5 py-3 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              {isCheckingStatus ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Checking Status with UIDAI…</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Check Verification Status</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onTriggerOtp}
              disabled={isInitiating}
              className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 text-xs font-medium px-5 py-3 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>Reopen DigiLocker Window</span>
            </button>
          </div>

          {/* Cancel / restart */}
          <div className="text-center pt-1 border-t border-blue-100">
            <button
              type="button"
              onClick={onResetSession}
              className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer underline underline-offset-2"
            >
              Click to re-enter Aadhaar number
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     3. INITIAL FORM STATE (Enter Aadhaar -> Launch DigiLocker)
  ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Step Header */}
      <div className="text-center space-y-1.5 mb-6">
        <div className="w-12 h-12 bg-slate-100 border border-slate-200 text-slate-700 rounded-2xl mx-auto flex items-center justify-center">
          <Smartphone className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">Aadhaar Identity Verification</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Authenticate your Aadhaar identity via the official Government DigiLocker / UIDAI system.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 p-6 rounded-2xl space-y-5">
        {/* Aadhaar Input */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Aadhaar Card Number (12 Digits) <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            maxLength={14}
            value={formData.aadhaarNumber || ""}
            onChange={handleAadhaarChange}
            placeholder="•••• •••• ••••"
            className={`w-full bg-white border rounded-xl px-4 py-3 text-base tracking-widest font-mono text-slate-900 focus:outline-none transition placeholder:tracking-normal placeholder:font-sans placeholder:text-sm ${
              aadhaarError
                ? "border-amber-400 bg-amber-50/20 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-xs"
            }`}
          />

          {aadhaarError && (
            <p className="text-xs text-amber-600 mt-2 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {aadhaarError}
            </p>
          )}

          {!aadhaarError && cleanAadhaar.length === 12 && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              12-digit Aadhaar number ready.
            </p>
          )}
        </div>

        {/* Consent Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-white border border-slate-200 rounded-xl">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
          <span className="text-xs text-slate-600 leading-relaxed">
            I hereby give consent to verify my Aadhaar identity via the official DigiLocker / UIDAI
            portal. I understand that UIDAI will send an authentication OTP to my Aadhaar-linked mobile
            number and share my verified name and masked Aadhaar with AquaPay in compliance with the{" "}
            <strong>Aadhaar Act, 2016</strong>.
          </span>
        </label>

        {/* Launch Button */}
        <button
          type="button"
          onClick={handleStartVerification}
          disabled={isInitiating || cleanAadhaar.length !== 12 || !consentGiven}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm py-3.5 rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isInitiating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to UIDAI DigiLocker…</span>
            </>
          ) : (
            <>
              <span>Verify with DigiLocker / UIDAI</span>
              <ExternalLink className="w-4 h-4" />
            </>
          )}
        </button>
      </div>

      {/* Trust & Security Footnote */}
      <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-white border border-slate-200 p-3.5 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          <strong>Why DigiLocker?</strong> Under RBI and UIDAI digital KYC regulations, Aadhaar OTP
          must be entered on the authorized government portal. This protects you from sharing your raw
          Aadhaar authentication code with any third party.
        </span>
      </div>
    </div>
  );
}

export default Step2AadhaarAuth;
