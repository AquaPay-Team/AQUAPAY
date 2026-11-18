import React, { useState } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertCircle,
  Lock,
  ArrowRight,
  FileCheck2,
} from "lucide-react";

/**
 * DigiLocker Official Logo Icon Component
 */
function DigiLockerLogo({ className = "w-10 h-10" }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="48" height="48" rx="12" fill="#0052CC" />
      <path
        d="M24 10C16.268 10 10 16.268 10 24C10 31.732 16.268 38 24 38C31.732 38 38 31.732 38 24C38 16.268 31.732 10 24 10Z"
        fill="#0052CC"
      />
      <circle cx="24" cy="24" r="14" fill="#0747A6" opacity="0.6" />
      {/* DigiLocker Keyhole / Cloud motif */}
      <path
        d="M24 14C19.582 14 16 17.582 16 22C16 24.387 17.049 26.529 18.711 27.994L18 34H30L29.289 27.994C30.951 26.529 32 24.387 32 22C32 17.582 28.418 14 24 14ZM24 20C25.105 20 26 20.895 26 22C26 22.739 25.598 23.385 25 23.732V28H23V23.732C22.402 23.385 22 22.739 22 22C22 20.895 22.895 20 24 20Z"
        fill="#FFFFFF"
      />
      <path
        d="M24 12V10M32.485 15.515L33.899 14.1M36 24H38M32.485 32.485L33.899 33.9M15.515 15.515L14.1 14.1M12 24H10M15.515 32.485L14.1 33.9"
        stroke="#FFFFFF"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * Step 2 – Aadhaar Identity Verification via DigiLocker (Aadhaar-First Workflow)
 *
 * Requirements:
 * 1. Zero manual 12-digit Aadhaar number input. Users never type their Aadhaar number.
 * 2. Clean verification interface with DigiLocker branding, explicit consent, and initiate button.
 * 3. Never collect OTP or passwords inside AquaPay.
 * 4. Only marks verified after authoritative confirmation from the backend API.
 * 5. On success, displays: Aadhaar Holder Name, Masked Aadhaar (XXXX XXXX 1234), Status, and Verification Date.
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
  sessionStatus = "idle",
  aadhaarErrorMessage = "",
  verificationState = null,
}) {
  const [consentGiven, setConsentGiven] = useState(true);

  // Authoritative data resolution from unified verificationState or props
  const isVerified =
    aadhaarVerified ||
    verificationState?.aadhaar?.status === "verified" ||
    sessionStatus === "verified";

  const holderName =
    verificationState?.aadhaar?.holderName ||
    verifiedData?.verifiedName ||
    formData?.fullName ||
    "Verified Merchant";

  // Aadhaar masking: Never show complete Aadhaar. Exactly format: XXXX XXXX 1234
  const getMaskedAadhaarNumber = () => {
    const rawMasked =
      verificationState?.aadhaar?.maskedNumber ||
      verifiedData?.maskedIdentifier ||
      formData?.aadhaarMasked ||
      "";

    if (rawMasked) {
      // If backend returned last 4 digits (e.g. XXXXXX1234 or •••• •••• 1234)
      const last4Match = String(rawMasked).match(/(\d{4})$/);
      if (last4Match) {
        return `XXXX XXXX ${last4Match[1]}`;
      }
      return rawMasked;
    }

    if (verifiedData?.last4) {
      return `XXXX XXXX ${verifiedData.last4}`;
    }

    return "XXXX XXXX ••••";
  };

  const verificationDate = (() => {
    const rawDate =
      verificationState?.aadhaar?.verifiedAt ||
      verifiedData?.verifiedAt ||
      verifiedData?.updatedAt;
    if (rawDate) {
      try {
        return new Date(rawDate).toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
      } catch {
        return "Today";
      }
    }
    return new Date().toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  })();

  const handleStartDigilocker = () => {
    if (!consentGiven) {
      return;
    }
    onTriggerOtp();
  };

  /* ─────────────────────────────────────────────────────────────
     1. VERIFIED STATE
  ────────────────────────────────────────────────────────────── */
  if (isVerified) {
    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-2 mb-4">
          <div className="w-14 h-14 bg-emerald-50 border-2 border-emerald-200 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 tracking-tight">
            Aadhaar Verification Successful
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Your identity has been authenticated with UIDAI through the authorized DigiLocker system.
          </p>
        </div>

        {/* Verified Certificate Card */}
        <div className="p-6 bg-gradient-to-b from-emerald-50/90 to-white border border-emerald-300 rounded-2xl space-y-5 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
            <div className="flex items-center gap-2.5">
              <DigiLockerLogo className="w-8 h-8 rounded-lg shadow-2xs" />
              <div>
                <span className="text-xs font-bold text-slate-900 block">UIDAI DigiLocker e-KYC</span>
                <span className="text-[11px] text-emerald-700 font-medium">Digital Identity Verified</span>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Verified
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* Aadhaar Holder Name */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                Aadhaar Holder Name
              </span>
              <span className="font-bold text-slate-900 text-sm tracking-wide">
                {holderName}
              </span>
            </div>

            {/* Masked Aadhaar Number */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                Masked Aadhaar Number
              </span>
              <span className="font-bold text-slate-900 text-sm font-mono tracking-widest">
                {getMaskedAadhaarNumber()}
              </span>
            </div>

            {/* Verification Status */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                Verification Status
              </span>
              <span className="font-semibold text-emerald-700 flex items-center gap-1.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                UIDAI Document Validated
              </span>
            </div>

            {/* Verification Date */}
            <div className="bg-white border border-emerald-200/80 rounded-xl p-3.5 shadow-2xs">
              <span className="text-slate-400 block text-[11px] mb-1 font-medium">
                Verification Date
              </span>
              <span className="font-semibold text-slate-800 text-xs">
                {verificationDate}
              </span>
            </div>
          </div>

          <div className="pt-2 text-xs text-emerald-800 font-medium flex items-center gap-2 bg-emerald-100/40 p-3 rounded-xl border border-emerald-200/60">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Your Aadhaar-verified name will be used to automatically verify and match your PAN card in Step 3.
            </span>
          </div>
        </div>

        {/* Security / Compliance Footnote */}
        <div className="flex items-center gap-2.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Identity verified via Meri Pehchaan DigiLocker gateway in compliance with the Aadhaar Act, 2016 and RBI Master Direction on Digital KYC.
          </span>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     2. ACTIVE DIGILOCKER SESSION STATE (Waiting for OTP on Gov Window)
  ────────────────────────────────────────────────────────────── */
  if (digilockerSessionActive) {
    const isFailedOrExpired =
      sessionStatus === "failed" ||
      sessionStatus === "expired" ||
      Boolean(aadhaarErrorMessage);

    return (
      <div className="space-y-6 max-w-2xl mx-auto">
        <div className="text-center space-y-1.5 mb-4">
          <div className="w-14 h-14 bg-blue-50 border border-blue-200 rounded-2xl mx-auto flex items-center justify-center">
            {isFailedOrExpired ? (
              <AlertCircle className="w-7 h-7 text-rose-500" />
            ) : (
              <RefreshCw className="w-7 h-7 text-blue-600 animate-spin" />
            )}
          </div>
          <h3 className="text-base font-bold text-slate-900">
            Government DigiLocker Authentication In Progress
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            UIDAI has dispatched a one-time password to your Aadhaar-registered mobile. Enter the OTP directly on the government portal.
          </p>
        </div>

        <div className="p-6 bg-slate-50/80 border border-blue-200 rounded-2xl space-y-5 shadow-xs">
          {/* Error / Expiry Alert */}
          {aadhaarErrorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{aadhaarErrorMessage}</span>
            </div>
          )}

          {/* Step Guidance */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                1
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Authenticate on the Official Government Window
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Switch to the opened DigiLocker / Meri Pehchaan window. Enter the OTP
                  received on your Aadhaar-linked mobile and authorize AquaPay.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 border border-slate-300 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                2
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-900">
                  Automatic Backend Verification
                </p>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Once you approve the request, AquaPay will automatically receive and verify your
                  Aadhaar credentials from the backend. You can also click "Check Verification Status".
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
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white text-xs font-semibold px-5 py-3 rounded-xl shadow-xs transition disabled:opacity-50 cursor-pointer"
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

          {/* Cancel / Restart Session */}
          <div className="text-center pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onResetSession}
              className="text-xs text-slate-500 hover:text-slate-800 transition cursor-pointer underline underline-offset-2"
            >
              Cancel or restart verification session
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ─────────────────────────────────────────────────────────────
     3. INITIAL STATE (No Manual Number Entry – DigiLocker-First)
  ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Step Header */}
      <div className="text-center space-y-2 mb-6">
        <div className="w-16 h-16 bg-blue-50 border border-blue-200 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
          <DigiLockerLogo className="w-10 h-10" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">
          Verify Your Aadhaar
        </h3>
        <p className="text-xs text-slate-600 max-w-lg mx-auto leading-relaxed">
          Securely verify your identity using DigiLocker. Your Aadhaar details will be retrieved
          through the authorized verification process.
        </p>
      </div>

      {/* Main Initiation Card */}
      <div className="bg-slate-50/80 border border-slate-200 p-6 sm:p-7 rounded-2xl space-y-5 shadow-xs">
        {/* Verification Features */}
        <div className="bg-white border border-slate-200/90 rounded-xl p-4 space-y-2.5 text-xs text-slate-700">
          <div className="flex items-center gap-2 font-semibold text-slate-900 border-b border-slate-100 pb-2">
            <FileCheck2 className="w-4 h-4 text-blue-600" />
            <span>Digital Identity Verification Features</span>
          </div>
          <div className="grid grid-cols-1 gap-2 pt-0.5 text-slate-600">
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Zero Manual Entry:</strong> You do not need to enter your 12-digit Aadhaar card number.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>Official Government Gateway:</strong> Aadhaar authentication takes place securely on the UIDAI DigiLocker portal.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-blue-600 font-bold">✓</span>
              <span><strong>High Privacy Standards:</strong> AquaPay never collects or stores your Aadhaar OTP or DigiLocker password.</span>
            </div>
          </div>
        </div>

        {/* Explicit Consent Checkbox */}
        <label className="flex items-start gap-3 cursor-pointer p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-300 transition">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
          />
          <span className="text-xs text-slate-600 leading-relaxed">
            I hereby give consent to verify my Aadhaar identity via the official DigiLocker / UIDAI
            portal. I understand that UIDAI will authenticate my identity and securely share my
            verified legal name and masked Aadhaar identifier with AquaPay in compliance with the{" "}
            <strong>Aadhaar Act, 2016</strong> and RBI Digital KYC guidelines.
          </span>
        </label>

        {/* Verify Button */}
        <button
          type="button"
          onClick={handleStartDigilocker}
          disabled={isInitiating || !consentGiven}
          className="w-full flex items-center justify-center gap-2.5 bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white font-semibold text-sm py-3.5 rounded-xl shadow-xs transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isInitiating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Connecting to DigiLocker…</span>
            </>
          ) : (
            <>
              <span>Verify Aadhaar with DigiLocker</span>
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
          must be entered exclusively on the authorized government portal. This ensures maximum protection
          for your sensitive identity credentials.
        </span>
      </div>
    </div>
  );
}

export default Step2AadhaarAuth;
