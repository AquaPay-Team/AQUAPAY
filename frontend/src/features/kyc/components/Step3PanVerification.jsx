import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Lock,
  UserCheck,
  AlertTriangle,
  ArrowRight,
  FileText,
} from "lucide-react";

/**
 * Tokenized full name comparison matching the authoritative backend pan.nameMatching algorithm
 */
export function compareFullNames(firstName, secondName) {
  if (!firstName || !secondName) return false;
  const normalize = (val) =>
    String(val)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\w\s]/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();

  const firstTokens = normalize(firstName).split(" ").filter(Boolean).sort();
  const secondTokens = normalize(secondName).split(" ").filter(Boolean).sort();

  if (firstTokens.length === 0 || secondTokens.length === 0 || firstTokens.length !== secondTokens.length) {
    return false;
  }
  return firstTokens.every((token, index) => token === secondTokens[index]);
}

/**
 * Step 3 – PAN Card Verification & Authoritative Name Matching
 *
 * Requirements:
 * 1. Uses Aadhaar-verified identity information from Step 2 as reference.
 * 2. Explicit PAN verification consent checkbox.
 * 3. Does not ask the user to manually re-enter their legal name.
 * 4. Authoritatively compares Aadhaar Holder Name and PAN Holder Name:
 *    - Scenario A (Match): Green card, successful match indicator, legal name updated to Aadhaar name.
 *    - Scenario B (Mismatch): Prominent warning, progression blocked, retry allowed.
 *    - Scenario C (Error / Not Found): Descriptive error, retry allowed.
 */
export function Step3PanVerification({
  formData = {},
  onChange = () => {},
  panVerified = false,
  panLoading = false,
  onVerifyPan = () => {},
  verificationState = null,
  panError: externalPanError = "",
  onRetryPan = () => {},
}) {
  const [panInputError, setPanInputError] = useState("");
  const [consentGiven, setConsentGiven] = useState(true);

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const currentPan = String(formData.panNumber || "").trim().toUpperCase();

  // Resolved Aadhaar-verified identity details from Step 2
  const aadhaarName =
    verificationState?.aadhaar?.holderName ||
    formData?.fullName ||
    "Aadhaar Verified Cardholder";

  const aadhaarMasked =
    verificationState?.aadhaar?.maskedNumber ||
    formData?.aadhaarMasked ||
    "XXXX XXXX ••••";

  // State resolution
  const panStatus = verificationState?.pan?.status || (panVerified ? "verified" : "pending");
  const nameMatchStatus = verificationState?.nameMatch?.status || (panVerified ? "verified" : "pending");
  const panHolderName = verificationState?.pan?.holderName || formData?.panName || "";
  const isPanVerified = panStatus === "verified" || panVerified;
  const isMismatch = panStatus === "mismatch" || nameMatchStatus === "mismatch";

  const handlePanChange = (e) => {
    const val = e.target.value.toUpperCase().slice(0, 10);
    onChange("panNumber", val);

    if (val.length === 0) {
      setPanInputError("");
    } else if (val.length < 10) {
      setPanInputError(`Entered ${val.length} of 10 characters (Format: ABCDE1234F)`);
    } else if (!panRegex.test(val)) {
      setPanInputError("Invalid PAN format. Must be 5 uppercase letters, 4 digits, and 1 letter (e.g. ABCDE1234F)");
    } else {
      setPanInputError("");
    }
  };

  const handleVerifyClick = () => {
    if (!currentPan) {
      setPanInputError("PAN Number is required.");
      return;
    }
    if (!panRegex.test(currentPan)) {
      setPanInputError("Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)");
      return;
    }
    if (!consentGiven) {
      setPanInputError("Explicit PAN verification consent is required.");
      return;
    }
    setPanInputError("");
    onVerifyPan();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      {/* Step Header */}
      <div className="text-center space-y-1.5 mb-6">
        <div className="w-14 h-14 bg-blue-50 border border-blue-200 text-blue-600 rounded-2xl mx-auto flex items-center justify-center shadow-xs">
          <CreditCard className="w-7 h-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 tracking-tight">PAN Card Verification</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Authenticate your Permanent Account Number (PAN) with the Income Tax Department and verify legal name alignment with Aadhaar.
        </p>
      </div>

      {/* ── 1. Aadhaar Reference Card (Read-Only from Step 2) ── */}
      <div className="bg-slate-50/80 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Aadhaar-Verified Identity Reference
            </span>
          </div>
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            <Lock className="w-3 h-3 text-emerald-600" /> Aadhaar Verified
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-400 block text-[11px] mb-1">Expected Legal Name</span>
            <span className="font-bold text-slate-900 text-sm tracking-wide block truncate">
              {aadhaarName}
            </span>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-xl p-3 shadow-2xs">
            <span className="text-slate-400 block text-[11px] mb-1">Masked Aadhaar</span>
            <span className="font-bold text-slate-900 text-sm font-mono tracking-widest block">
              {aadhaarMasked}
            </span>
          </div>
        </div>
      </div>

      {/* ── 2. PAN Input Form ── */}
      <div className="bg-white border border-slate-200 p-6 rounded-2xl space-y-5 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            PAN Number (10 Alphanumeric Characters) <span className="text-rose-500">*</span>
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <input
                type="text"
                maxLength={10}
                disabled={isPanVerified || panLoading}
                value={currentPan}
                onChange={handlePanChange}
                placeholder="ABCDE1234F"
                className={`w-full bg-white border rounded-xl px-4 py-2.5 text-base uppercase tracking-widest font-mono text-slate-900 focus:outline-none transition placeholder:tracking-normal placeholder:font-sans placeholder:text-sm ${
                  panInputError || externalPanError || isMismatch
                    ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                    : isPanVerified
                    ? "border-emerald-300 bg-emerald-50/30 text-slate-700"
                    : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-2xs"
                }`}
              />
            </div>

            <button
              type="button"
              onClick={handleVerifyClick}
              disabled={panLoading || isPanVerified || currentPan.length !== 10 || !consentGiven}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white px-6 py-2.5 rounded-xl text-xs font-semibold transition disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer shadow-xs whitespace-nowrap min-w-[130px]"
            >
              {panLoading ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying…</span>
                </>
              ) : isPanVerified ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                  <span>Verified ✓</span>
                </>
              ) : (
                <span>Verify PAN</span>
              )}
            </button>
          </div>

          {/* Validation Feedback */}
          {panInputError && (
            <p className="text-xs text-rose-500 mt-2 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{panInputError}</span>
            </p>
          )}

          {!panInputError && currentPan.length === 10 && panRegex.test(currentPan) && !isPanVerified && !isMismatch && (
            <p className="text-xs text-emerald-600 mt-2 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>Valid PAN format. Click 'Verify PAN' to authenticate against the Income Tax database.</span>
            </p>
          )}
        </div>

        {/* Explicit PAN Consent */}
        {!isPanVerified && (
          <label className="flex items-start gap-3 cursor-pointer p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              disabled={isPanVerified}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I hereby give explicit consent to verify my PAN details with the Income Tax Department
              (NSDL/UTI) via IDTO. I understand that the verified PAN holder name will be compared
              with my Aadhaar identity record.
            </span>
          </label>
        )}

        {/* ── SCENARIO A: NAMES MATCH & PAN VERIFIED ── */}
        {isPanVerified && !isMismatch && (
          <div className="p-5 bg-gradient-to-b from-emerald-50/90 to-white border border-emerald-300 rounded-2xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Aadhaar & PAN Name Match Confirmed</span>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-3 py-1 rounded-full">
                Names Match ✓
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs text-slate-700">
              <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-2xs">
                <span className="text-slate-400 block text-[11px] mb-1">Aadhaar Verified Name</span>
                <span className="font-bold text-slate-900 text-sm block truncate">{aadhaarName}</span>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-2xs">
                <span className="text-slate-400 block text-[11px] mb-1">PAN Cardholder Name</span>
                <span className="font-bold text-slate-900 text-sm block truncate">{panHolderName || aadhaarName}</span>
              </div>
              <div className="bg-white border border-emerald-200 rounded-xl p-3 shadow-2xs">
                <span className="text-slate-400 block text-[11px] mb-1">Tax Database Record</span>
                <span className="font-mono font-bold text-slate-900 text-sm block">
                  {formData.panMasked || `XXXXXX${currentPan.slice(-4)}`}
                </span>
              </div>
            </div>

            <div className="p-3 bg-emerald-100/50 rounded-xl border border-emerald-200 text-xs text-emerald-900 font-medium space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Legal Name Confirmed & Protected:</span>
              </p>
              <p className="text-[11px] text-emerald-700 leading-relaxed pl-5">
                Your Aadhaar and PAN details have been successfully verified. Your registered legal name has
                been updated using your Aadhaar-verified name (<strong>{aadhaarName}</strong>) and is now read-only.
              </p>
            </div>
          </div>
        )}

        {/* ── SCENARIO B: NAME MISMATCH WARNING ── */}
        {isMismatch && (
          <div className="p-5 bg-amber-50/90 border border-amber-300 rounded-2xl space-y-4 shadow-xs">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <span>Name Mismatch Warning</span>
            </div>

            <p className="text-xs text-amber-800 leading-relaxed">
              The name on your Aadhaar and PAN records does not match. Please check your identity documents
              or contact support. Progression to subsequent steps is restricted until identity documents match.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-white border border-amber-200 rounded-xl p-3">
                <span className="text-slate-400 block text-[11px] mb-1">Name on Aadhaar</span>
                <span className="font-bold text-slate-900 text-sm">{aadhaarName}</span>
              </div>
              <div className="bg-white border border-amber-200 rounded-xl p-3">
                <span className="text-slate-400 block text-[11px] mb-1">Name on PAN Card</span>
                <span className="font-bold text-rose-600 text-sm">{panHolderName || "Mismatch"}</span>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-between">
              <button
                type="button"
                onClick={onRetryPan}
                className="text-xs font-semibold text-amber-900 hover:text-amber-950 underline underline-offset-2 cursor-pointer"
              >
                Re-enter PAN Number
              </button>
              <a
                href="mailto:support@aquapay.in"
                className="text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Contact Compliance Support
              </a>
            </div>
          </div>
        )}

        {/* ── SCENARIO C: EXTERNAL OR PROVIDER ERROR ── */}
        {externalPanError && !isMismatch && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-semibold block">PAN Verification Failed</span>
              <span className="block">{externalPanError}</span>
            </div>
          </div>
        )}
      </div>

      {/* Security Footnote */}
      <div className="flex items-start gap-2.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 p-3.5 rounded-xl">
        <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
        <span>
          PAN verification is executed against official NSDL / Income Tax records in compliance with
          Income Tax Rule 114 and RBI Anti-Money Laundering (AML) directives.
        </span>
      </div>
    </div>
  );
}

export default Step3PanVerification;
