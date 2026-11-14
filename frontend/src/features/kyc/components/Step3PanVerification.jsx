import React, { useState } from "react";
import { CreditCard, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";

export function Step3PanVerification({
  formData,
  onChange,
  panVerified,
  panLoading,
  onVerifyPan,
}) {
  const [panError, setPanError] = useState("");

  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const currentPan = String(formData.panNumber || "").trim().toUpperCase();

  const handlePanChange = (e) => {
    const val = e.target.value.toUpperCase().slice(0, 10);
    onChange("panNumber", val);

    // Instant validation
    if (val.length === 0) {
      setPanError("");
    } else if (val.length < 10) {
      setPanError(`Entered ${val.length} of 10 characters (Must follow ABCDE1234F format)`);
    } else if (!panRegex.test(val)) {
      setPanError("Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)");
    } else {
      setPanError("");
    }
  };

  const handleVerifyClick = () => {
    if (!currentPan) {
      setPanError("PAN Number is required.");
      return;
    }
    if (!panRegex.test(currentPan)) {
      setPanError("Invalid PAN format. Must be 5 letters, 4 digits, and 1 letter (e.g. ABCDE1234F)");
      return;
    }
    setPanError("");
    onVerifyPan();
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="text-center space-y-1.5 mb-6">
        <div className="w-11 h-11 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl mx-auto flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-blue-600" />
        </div>
        <h3 className="text-base font-semibold text-slate-900">PAN Verification</h3>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Verify your Permanent Account Number (PAN) registered with the Income Tax Department to enable commercial settlement facilities.
        </p>
      </div>

      <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl space-y-4">
        {/* PAN Input */}
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1.5">
            PAN Number <span className="text-rose-500">*</span>
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              maxLength={10}
              disabled={panVerified}
              value={formData.panNumber || ""}
              onChange={handlePanChange}
              placeholder="ABCDE1234F"
              className={`flex-1 bg-white border rounded-xl px-4 py-2.5 text-base uppercase tracking-widest font-mono text-slate-900 focus:outline-none transition placeholder:tracking-normal placeholder:font-sans placeholder:text-sm ${
                panError
                  ? "border-rose-400 bg-rose-50/20 focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                  : panVerified
                  ? "border-emerald-300 bg-emerald-50/20 text-slate-700"
                  : "border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              }`}
            />
            <button
              type="button"
              onClick={handleVerifyClick}
              disabled={panLoading || panVerified || currentPan.length !== 10}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.99] text-white px-5 py-2.5 rounded-xl text-xs font-medium transition disabled:opacity-40 flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap"
            >
              {panLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {panVerified ? "Verified ✓" : "Verify PAN"}
            </button>
          </div>

          {/* Instant Inline Error / Feedback */}
          {panError && (
            <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              {panError}
            </p>
          )}

          {!panError && currentPan.length === 10 && panRegex.test(currentPan) && !panVerified && (
            <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              Valid PAN format. Click 'Verify PAN' to authenticate against the tax database.
            </p>
          )}
        </div>

        {/* Verified Card */}
        {panVerified && (
          <div className="p-5 bg-emerald-50/80 border border-emerald-300 rounded-2xl space-y-3.5 shadow-xs">
            <div className="flex items-center gap-2.5 text-emerald-900 font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>PAN Records Verified via NSDL / Income Tax Database</span>
            </div>
            <div className="text-xs text-slate-700 grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-3 border-t border-emerald-200/70">
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Cardholder Legal Name:</span>
                <span className="font-semibold text-slate-900 text-sm">
                  {formData.panName || formData.fullName || "Verified User"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Masked PAN:</span>
                <span className="font-mono font-semibold text-slate-900 text-sm">
                  {formData.panMasked || `••••••${currentPan.slice(-4) || "XXXX"}`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] mb-0.5">Tax Database Status:</span>
                <span className="text-emerald-700 font-semibold text-xs flex items-center gap-1 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Active & Valid Record
                </span>
              </div>
            </div>
            <div className="pt-2 text-[11px] text-emerald-800 font-medium border-t border-emerald-100 flex items-center gap-1.5">
              <span>✓ Official legal name matching completed against UIDAI Aadhaar identity.</span>
            </div>
          </div>
        )}

        {/* Help Banner */}
        {!panVerified && (
          <div className="text-xs text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200 flex items-start gap-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <span>
              Enter your 10-character PAN number and click 'Verify PAN'. Cardholder name must match your legal business registration.
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default Step3PanVerification;
