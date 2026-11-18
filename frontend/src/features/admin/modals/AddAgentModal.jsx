import React, { useState } from 'react';
import { UserPlus, X, Eye, EyeOff, Lock, Smartphone } from 'lucide-react';
import { DynamicRoleSelector } from '../components/DynamicRoleSelector';

export function AddAgentModal({
  addAgentModalOpen,
  setAddAgentModalOpen,
  handleOnboardAgent
}) {
  if (!addAgentModalOpen) return null;

  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState("RT");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordCustom, setIsPasswordCustom] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const handleMobileChange = (e) => {
    const cleanNum = e.target.value.replace(/\D/g, "").slice(0, 10);
    setMobile(cleanNum);
    // User creation default password is user's mobile number
    if (!isPasswordCustom) {
      setPassword(cleanNum);
    }
  };

  const handlePasswordChange = (e) => {
    setIsPasswordCustom(true);
    setPassword(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    setIsLoading(true);

    const finalPassword = password || mobile || "Welcome@123";

    const newObj = {
      name: form.agentName.value,
      mobile: mobile || form.mobile.value,
      email: form.email.value,
      role: selectedRole || form.role?.value || "RT",
      password: finalPassword,
      shopname: form.shopname.value,
      city: form.city.value,
      state: form.state.value,
      pincode: form.pincode.value,
      address: form.address.value,
    };

    await handleOnboardAgent(newObj);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" /> Onboard New Agent
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Creates a real agent record in MySQL via POST /api/users
            </p>
          </div>
          <button
            onClick={() => setAddAgentModalOpen(false)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Full Name *</label>
            <input
              type="text"
              name="agentName"
              required
              placeholder="e.g. Ramesh Kumar"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
              <div className="relative">
                <input
                  type="tel"
                  name="mobile"
                  value={mobile}
                  onChange={handleMobileChange}
                  maxLength={10}
                  required
                  placeholder="10-digit mobile"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Tier *</label>
              <DynamicRoleSelector
                value={selectedRole}
                onChange={setSelectedRole}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address *</label>
              <input
                type="email"
                name="email"
                required
                placeholder="agent@example.com"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>Default Password *</span>
                <span className="text-[10px] text-blue-600 font-normal">
                  (User's Mobile)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  placeholder="Defaults to mobile number"
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 pr-8 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
          </div>

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
                placeholder="6-digit PIN"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              placeholder="Shop address / locality"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors shadow-2xs mt-3 cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Creating Agent in Database...' : 'Create Agent Account'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default AddAgentModal;
