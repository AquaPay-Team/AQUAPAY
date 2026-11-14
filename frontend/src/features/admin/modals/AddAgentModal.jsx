import React, { useState } from 'react';
import { UserPlus, X } from 'lucide-react';

export function AddAgentModal({
  addAgentModalOpen,
  setAddAgentModalOpen,
  handleOnboardAgent
}) {
  if (!addAgentModalOpen) return null;

  const [isLoading, setIsLoading] = useState(false);

  const currentUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const creatorRoleId = Number(currentUser.role_id) || 1;

  // Permitted child roles according to backend role_hierarchy:
  // Admin (1) -> Sub Admin (2) -> NSM (3) -> SH (4) -> CNF (5) -> MD (6) -> DT (7) -> RT (8)
  const allRoles = [
    { value: 'SA', label: 'Sub Admin (SA)', maxCreatorRole: 1 },
    { value: 'NSM', label: 'NSM / ZSH', maxCreatorRole: 2 },
    { value: 'SH', label: 'State Head (SH)', maxCreatorRole: 3 },
    { value: 'CNF', label: 'CNF / ASM', maxCreatorRole: 4 },
    { value: 'MD', label: 'Master Distributor (MD)', maxCreatorRole: 5 },
    { value: 'DT', label: 'Distributor (DT)', maxCreatorRole: 6 },
    { value: 'RT', label: 'Retailer (RT)', maxCreatorRole: 7 },
  ];

  const permittedRoles = allRoles.filter((r) => creatorRoleId <= r.maxCreatorRole);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    setIsLoading(true);

    const newObj = {
      name: form.agentName.value,
      mobile: form.mobile.value,
      email: form.email.value,
      role: form.role.value,
      password: form.password.value,
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
              <input
                type="tel"
                name="mobile"
                required
                placeholder="10-digit mobile"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Role Tier *</label>
              <select
                name="role"
                defaultValue={permittedRoles[permittedRoles.length - 1]?.value || "RT"}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500 font-medium"
              >
                {permittedRoles.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
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
              <label className="block font-semibold text-slate-700 mb-1">Default Password *</label>
              <input
                type="password"
                name="password"
                defaultValue="Welcome@123"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
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
