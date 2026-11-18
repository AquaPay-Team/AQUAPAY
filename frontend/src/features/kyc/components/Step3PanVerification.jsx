import React, { useState } from "react";
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from "lucide-react";

/**
 * Step 3 – PAN Card Verification
 * Clean, required-only UI elements.
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

  // State resolution
  const panStatus = verificationState?.pan?.status || (panVerified ? "verified" : "pending");
  const nameMatchStatus = verificationState?.nameMatch?.status || (panVerified ? "verified" : "pending");
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
      setPanInputError("Invalid PAN format (e.g. ABCDE1234F)");
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
      setPanInputError("Please accept verification consent.");
      return;
    }
    setPanInputError("");
    onVerifyPan();
  };

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-1 mb-4">
        <div className="w-12 h-12 bg-blue-50 border border-blue-200 text-blue-600 rounded-xl mx-auto flex items-center justify-center">
          <CreditCard className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900">PAN Card Verification</h3>
        <p className="text-xs text-slate-500">
          Enter your 10-character Permanent Account Number (PAN) for verification.
        </p>
      </div>

      {/* Main PAN Form */}
      <div className="bg-white border border-slate-200 p-5 sm:p-6 rounded-2xl space-y-4 shadow-xs">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            PAN Number <span className="text-rose-500">*</span>
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

          {/* Input Format Error */}
          {panInputError && (
            <p className="text-xs text-rose-500 mt-2 flex items-center gap-1.5 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{panInputError}</span>
            </p>
          )}
        </div>

        {/* Consent Checkbox */}
        {!isPanVerified && (
          <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-xl hover:border-blue-300 transition">
            <input
              type="checkbox"
              checked={consentGiven}
              onChange={(e) => setConsentGiven(e.target.checked)}
              disabled={isPanVerified}
              className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
            />
            <span className="text-xs text-slate-600 leading-relaxed">
              I give consent to verify my PAN details with the Income Tax Department via IDTO.
            </span>
          </label>
        )}

        {/* Verified Status Banner */}
        {isPanVerified && !isMismatch && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-800">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">PAN Verified Successfully</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-700">
              {formData.panMasked || `XXXXXX${currentPan.slice(-4)}`}
            </span>
          </div>
        )}

        {/* Mismatch Error: "pan holder does not match use valid pan card" */}
        {isMismatch && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs text-rose-700">
            <div className="flex items-start gap-2 font-semibold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>PAN card holder name does not match. Please use a valid PAN card.</span>
            </div>
            <div className="pl-6 flex items-center gap-3">
              <button
                type="button"
                onClick={onRetryPan}
                className="text-xs font-semibold text-rose-800 hover:text-rose-950 underline underline-offset-2 cursor-pointer"
              >
                Re-enter PAN Number
              </button>
            </div>
          </div>
        )}

        {/* Other External/Provider Error */}
        {externalPanError && !isMismatch && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span>{externalPanError}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Step3PanVerification;
