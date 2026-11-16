import React, { useState, useEffect } from 'react';
import { Settings, X, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export function ActionModal({
  actionModalUser,
  setActionModalUser,
  handleUpdateMemberDetails
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    mobile: '',
    shopname: '',
    city: '',
    state: '',
    pincode: '',
    address: '',
  });

  // Load existing user details whenever modal opens or actionModalUser changes
  useEffect(() => {
    if (actionModalUser) {
      setFormData({
        name: actionModalUser.name || '',
        email: actionModalUser.email || '',
        mobile: actionModalUser.mobile || '',
        shopname: actionModalUser.shopname || '',
        city: actionModalUser.city || '',
        state: actionModalUser.state || '',
        pincode: actionModalUser.pincode || '',
        address: actionModalUser.address || '',
      });
      setErrorMessage('');
    }
  }, [actionModalUser]);

  if (!actionModalUser) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrorMessage('');
  };

  const handleClose = () => {
    if (isLoading) return;
    setErrorMessage('');
    setActionModalUser(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const original = actionModalUser;
    const payload = {};

    // 1. Full Name
    const newName = formData.name.trim();
    if (newName && newName !== (original.name || '').trim()) {
      if (newName.length < 2 || !/^[a-zA-Z\s]+$/.test(newName)) {
        setErrorMessage("Name must contain at least 2 characters with letters and spaces only.");
        return;
      }
      payload.name = newName;
    }

    // 2. Mobile
    const newMobile = formData.mobile.trim().replace(/\D/g, '');
    const origMobile = String(original.mobile || '').trim().replace(/\D/g, '');
    if (newMobile && newMobile !== origMobile) {
      if (newMobile.length !== 10) {
        setErrorMessage("Mobile number must be a valid 10-digit number.");
        return;
      }
      payload.mobile = newMobile;
    }

    // 3. CRITICAL: Email Update
    // If email is identical to the current email, DO NOT send it in payload,
    // because backend explicitly rejects unchanged email with:
    // "New email must be different from the current email"
    const newEmail = formData.email.trim().toLowerCase();
    const origEmail = String(original.email || '').trim().toLowerCase();
    if (newEmail && newEmail !== origEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
        setErrorMessage("Please provide a valid email format.");
        return;
      }
      payload.email = newEmail;
    }

    // 4. Shop Name
    const newShop = formData.shopname.trim();
    if (newShop !== (original.shopname || '').trim()) {
      payload.shopname = newShop || null;
    }

    // 5. City
    const newCity = formData.city.trim();
    if (newCity !== (original.city || '').trim()) {
      payload.city = newCity || null;
    }

    // 6. State
    const newState = formData.state.trim();
    if (newState !== (original.state || '').trim()) {
      payload.state = newState || null;
    }

    // 7. Pincode
    const newPin = formData.pincode.trim();
    if (newPin !== String(original.pincode || '').trim()) {
      if (newPin && !/^[1-9][0-9]{5}$/.test(newPin)) {
        setErrorMessage("Pincode must be a valid 6-digit Indian PIN.");
        return;
      }
      payload.pincode = newPin || null;
    }

    // 8. Address
    const newAddr = formData.address.trim();
    if (newAddr !== (original.address || '').trim()) {
      payload.address = newAddr || null;
    }

    // Check if any fields were actually changed
    if (Object.keys(payload).length === 0) {
      toast.info("No changes detected.");
      setActionModalUser(null);
      return;
    }

    setIsLoading(true);
    try {
      await handleUpdateMemberDetails(actionModalUser.id, payload);
      // Close modal on success
      setActionModalUser(null);
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || "Failed to update agent details";
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg p-6 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
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
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer p-1 rounded-lg hover:bg-slate-100 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="font-medium">{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          {/* Full Name & Mobile */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                name="mobile"
                maxLength={10}
                value={formData.mobile}
                onChange={(e) => handleChange('mobile', e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Email Address & Shop Name */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Email Address
                <span className="text-[10px] text-slate-400 font-normal ml-1">(Editable)</span>
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Shop / Outlet Name</label>
              <input
                type="text"
                name="shopname"
                value={formData.shopname}
                onChange={(e) => handleChange('shopname', e.target.value)}
                placeholder="Business Name"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* City, State, Pincode */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">City</label>
              <input
                type="text"
                name="city"
                value={formData.city}
                onChange={(e) => handleChange('city', e.target.value)}
                placeholder="City"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">State</label>
              <input
                type="text"
                name="state"
                value={formData.state}
                onChange={(e) => handleChange('state', e.target.value)}
                placeholder="State"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                name="pincode"
                maxLength={6}
                value={formData.pincode}
                onChange={(e) => handleChange('pincode', e.target.value)}
                placeholder="6-digit PIN"
                className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Address</label>
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Street Address"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Read-Only Status & Role Badge */}
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

          {/* Action Buttons */}
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
              disabled={isLoading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-lg text-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoading ? 'Saving Changes to DB...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ActionModal;
