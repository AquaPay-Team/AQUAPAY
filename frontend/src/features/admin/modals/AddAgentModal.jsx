import React, { useState, useEffect, useCallback } from 'react';
import {
  UserPlus,
  X,
  Eye,
  EyeOff,
  Copy,
  Check,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Secure cryptographic password generator using Web Crypto API
 * Generates a random 12-character temporary password using the available character sets.
 */
function generateSecurePassword(length = 12) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const numbers = "23456789";
  const symbols = "@$!%*?&#";
  const allChars = upper + lower + numbers + symbols;

  const getRandomChar = (charset) => {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return charset[array[0] % charset.length];
  };

  const passwordChars = [
    getRandomChar(upper),
    getRandomChar(lower),
    getRandomChar(numbers),
    getRandomChar(symbols),
  ];

  for (let i = passwordChars.length; i < length; i++) {
    passwordChars.push(getRandomChar(allChars));
  }

  // Cryptographic Fisher-Yates shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    const j = array[0] % (i + 1);
    [passwordChars[i], passwordChars[j]] = [passwordChars[j], passwordChars[i]];
  }

  return passwordChars.join("");
}

export function AddAgentModal({
  addAgentModalOpen,
  setAddAgentModalOpen,
  handleOnboardAgent,
  selectedRole = "",
}) {
  // --- ALL HOOKS AT TOP LEVEL (Rules of Hooks) ---
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);
  const [createdAgent, setCreatedAgent] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});

  // Generate a fresh unique password each time the modal opens
  useEffect(() => {
    if (addAgentModalOpen) {
      setPassword(generateSecurePassword(12));
      setShowPassword(true);
      setCopied(false);
      setCreatedAgent(null);
      setFieldErrors({});
    } else {
      // Clear password from state completely when modal closes
      setPassword('');
      setCreatedAgent(null);
      setFieldErrors({});
    }
  }, [addAgentModalOpen]);

  const handleRegeneratePassword = useCallback(() => {
    const newPwd = generateSecurePassword(12);
    setPassword(newPwd);
    setCopied(false);
    toast.info("Generated new secure password");
  }, []);

  const handleCopyPassword = useCallback(async () => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Failed to copy password");
    }
  }, [password]);

  // Handle closing modal and wiping sensitive state
  const handleClose = useCallback(() => {
    setPassword('');
    setCreatedAgent(null);
    setFieldErrors({});
    setAddAgentModalOpen(false);
  }, [setAddAgentModalOpen]);

  const selectedRoleSlug = String(selectedRole || "");

  const isPasswordValid = password.length >= 8;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const errors = {};

    const nameVal = form.agentName.value.trim();
    if (!nameVal || nameVal.length < 2) {
      errors.name = "Full Name must be at least 2 characters (letters only)";
    } else if (!/^[a-zA-Z\s]+$/.test(nameVal)) {
      errors.name = "Name must contain only letters and spaces";
    }

    const mobileVal = form.mobile.value.trim().replace(/\D/g, "");
    if (!mobileVal || mobileVal.length !== 10) {
      errors.mobile = "Mobile must be a valid 10-digit number";
    }

    const emailVal = form.email.value.trim().toLowerCase();
    if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
      errors.email = "Please enter a valid email address";
    }

    if (!selectedRoleSlug) {
      toast.error("Select a permitted role directory before creating a user");
      return;
    }

    if (password.length < 8) {
      errors.password = "Password must contain at least 8 characters";
    }

    const pincodeVal = form.pincode.value.trim();
    if (pincodeVal && (!/^[1-9][0-9]{5}$/.test(pincodeVal))) {
      errors.pincode = "Pincode must be a 6-digit number";
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      toast.error("Please fix form errors before submitting");
      return;
    }

    setFieldErrors({});
    setIsLoading(true);

    const newObj = {
      name: nameVal,
      mobile: mobileVal,
      email: emailVal,
      role: selectedRoleSlug,
      password: password,
      shopname: form.shopname.value.trim() || null,
      city: form.city.value.trim() || null,
      state: form.state.value.trim() || null,
      pincode: pincodeVal || null,
      address: form.address.value.trim() || null,
    };

    try {
      const createdData = await handleOnboardAgent(newObj);
      if (createdData) {
        // Transition to success & handoff view
        setCreatedAgent({
          ...newObj,
          id: createdData.id || createdData.user?.id,
          tempPassword: password,
        });
      }
    } catch {
      // Error handled by caller
    } finally {
      setIsLoading(false);
    }
  };

  // Conditional early return AFTER all hooks
  if (!addAgentModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              {createdAgent ? "User Account Created" : "Create User"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {createdAgent
                ? "Account has been successfully registered in the database"
                : "Enter the account details for the selected role directory."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* --- SUCCESS / CREDENTIAL HANDOFF VIEW --- */}
        {createdAgent ? (
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
        ) : (
          /* --- CREATION FORM --- */
          <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
            {/* Full Name */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                name="agentName"
                required
                placeholder="e.g. Ramesh Kumar (letters only)"
                className={`w-full bg-slate-50 border rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 ${
                  fieldErrors.name ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                }`}
              />
              {fieldErrors.name && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.name}
                </p>
              )}
            </div>

            {/* Mobile Number */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <input
                type="tel"
                name="mobile"
                maxLength={10}
                required
                placeholder="10-digit mobile"
                className={`w-full bg-slate-50 border rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 ${
                  fieldErrors.mobile ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                }`}
              />
              {fieldErrors.mobile && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{fieldErrors.mobile}</p>
              )}
            </div>

            {/* Email Address */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                name="email"
                required
                placeholder="agent@example.com"
                className={`w-full bg-slate-50 border rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 ${
                  fieldErrors.email ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                }`}
              />
              {fieldErrors.email && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  {fieldErrors.email}
                </p>
              )}
            </div>

            {/* Password field uses the same input treatment as the other fields. */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="create-user-password" className="block font-semibold text-slate-700 mb-1">
                  Default Temporary Password *
                </label>
                <button
                  type="button"
                  onClick={handleRegeneratePassword}
                  className="text-[11px] text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Generate New</span>
                </button>
              </div>

              <div className="relative">
                <input
                  id="create-user-password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  placeholder="Enter or generate password"
                  className={`w-full bg-slate-50 border rounded-lg p-2 pr-16 text-xs focus:outline-none focus:border-blue-500 ${
                    fieldErrors.password ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                  }`}
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 transition-colors"
                    title={showPassword ? "Hide password" : "Show password"}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors"
                    title="Copy password"
                    aria-label="Copy password"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              {fieldErrors.password && (
                <p className="text-[11px] text-rose-500 mt-1 font-medium">{fieldErrors.password}</p>
              )}
            </div>

            {/* Shop Name & City */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Shop / Outlet Name</label>
                <input
                  type="text"
                  name="shopname"
                  placeholder="e.g. Ramesh Telecom"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">City</label>
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Surat"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* State & Pincode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  placeholder="e.g. Gujarat"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
                <input
                  type="text"
                  name="pincode"
                  maxLength={6}
                  placeholder="6-digit PIN"
                  className={`w-full bg-slate-50 border rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 ${
                    fieldErrors.pincode ? "border-rose-400 bg-rose-50/20" : "border-slate-200"
                  }`}
                />
                {fieldErrors.pincode && (
                  <p className="text-[11px] text-rose-500 mt-1 font-medium">{fieldErrors.pincode}</p>
                )}
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Address</label>
              <input
                type="text"
                name="address"
                placeholder="Shop address / locality"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Submit Button */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-semibold text-xs transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !isPasswordValid}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              >
                {isLoading ? 'Creating Agent in Database...' : 'Create Agent Account'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddAgentModal;
