import React, { useState } from 'react';
import { Settings, X } from 'lucide-react';

export function ActionModal({
  actionModalUser,
  setActionModalUser,
  handleUpdateMemberDetails
}) {
  if (!actionModalUser) return null;

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    setIsLoading(true);

    const payload = {};
    if (form.name?.value?.trim()) payload.name = form.name.value.trim();
    if (form.email?.value?.trim()) payload.email = form.email.value.trim();
    if (form.mobile?.value?.trim()) payload.mobile = form.mobile.value.trim();
    if (form.shopname?.value?.trim()) payload.shopname = form.shopname.value.trim();
    if (form.city?.value?.trim()) payload.city = form.city.value.trim();
    if (form.state?.value?.trim()) payload.state = form.state.value.trim();
    if (form.pincode?.value?.trim()) payload.pincode = form.pincode.value.trim();
    if (form.address?.value?.trim()) payload.address = form.address.value.trim();

    await handleUpdateMemberDetails(actionModalUser.id, payload);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center pb-3 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Settings className="w-5 h-5 text-slate-700" /> Edit Agent Configuration
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Updates record #{actionModalUser.id} directly in MySQL database
            </p>
          </div>
          <button
            onClick={() => setActionModalUser(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                defaultValue={actionModalUser.name}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                defaultValue={actionModalUser.mobile}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                defaultValue={actionModalUser.email}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shop / Outlet Name</label>
              <input
                type="text"
                name="shopname"
                defaultValue={actionModalUser.shopname || ''}
                placeholder="Business Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                defaultValue={actionModalUser.city || ''}
                placeholder="City"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                defaultValue={actionModalUser.state || ''}
                placeholder="State"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                name="pincode"
                defaultValue={actionModalUser.pincode || ''}
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
              defaultValue={actionModalUser.address || ''}
              placeholder="Street Address"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
            <div>
              <span className="font-bold text-slate-800">KYC Status</span>
              <span className="text-slate-500 block text-[11px] capitalize">
                {actionModalUser.kyc?.status || 'Pending'}
              </span>
            </div>
            <span className="text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded">
              Role: {actionModalUser.role_name || actionModalUser.role_slug}
            </span>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            {isLoading ? 'Saving Changes to DB...' : 'Save Changes in Backend'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default ActionModal;
