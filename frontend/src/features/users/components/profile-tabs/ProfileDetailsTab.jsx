import React, { useState, useEffect } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { parseApiError } from "@/lib/errors";
import { updateBackendUser } from "@/features/users/api/usersApi";

const prettyKycText = (value) =>
  value == null || value === ""
    ? "—"
    : String(value).replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

export function ProfileDetailsTab({
  userId,
  profile,
  admin,
  kycData,
  onProfileUpdated,
}) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    mobile: "",
    shopname: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    status: "active",
    dob: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        email: profile.email || "",
        mobile: profile.mobile || "",
        shopname: profile.shopname || "",
        address: profile.address || "",
        city: profile.city || "",
        state: profile.state || "",
        pincode: profile.pincode || "",
        status: profile.status || "active",
        dob: profile.dob || "",
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!userId) return;

    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        mobile: formData.mobile.trim(),
        shopname: formData.shopname.trim(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode ? String(formData.pincode).trim() : null,
        status: formData.status,
      };

      // Only send email if the admin actually modified it
      const currentEmail = String(profile?.email || "").trim().toLowerCase();
      const enteredEmail = String(formData.email || "").trim().toLowerCase();
      if (enteredEmail && enteredEmail !== currentEmail) {
        payload.email = formData.email.trim();
      }

      await updateBackendUser(userId, payload);
      toast.success("User profile updated successfully");
      if (onProfileUpdated) await onProfileUpdated();
    } catch (err) {
      toast.error(parseApiError(err).message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const aadhaarRecord = kycData?.verifications?.find(
    (v) => v.verification_type?.toLowerCase() === "aadhaar"
  );
  const panRecord = kycData?.verifications?.find(
    (v) => v.verification_type?.toLowerCase() === "pan"
  );

  return (
    <form
      onSubmit={handleSave}
      className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-2xs space-y-6"
    >
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">User Profile Details</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            {admin
              ? "Update account information, business credentials, and KYC mappings"
              : "Verified account information and business credentials"}
          </p>
        </div>
        {admin && (
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-xl shadow-xs"
          >
            {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
            {isSaving ? "Saving..." : "Save Changes"}
          </Button>
        )}
      </div>

      {!admin && (
        <div className="rounded-xl bg-slate-50 border border-slate-200/80 p-3.5 flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 leading-relaxed">
            Your registered identification details and business credentials are verified and locked to protect your merchant account. To request an update to your legal details, please contact AquaPay Support.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
        {/* Full Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Full Name <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => handleChange("name", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="Enter full legal name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Email Address */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Email Address <span className="text-rose-500">*</span>
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => handleChange("email", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="email@example.com"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Phone Number */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Phone Number <span className="text-rose-500">*</span>
          </label>
          <input
            type="text"
            value={formData.mobile}
            onChange={(e) => handleChange("mobile", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="+919876543210"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
          />
        </div>

        {/* Date of Birth */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Date of Birth (DOB)
          </label>
          <input
            type="date"
            value={formData.dob}
            onChange={(e) => handleChange("dob", e.target.value)}
            disabled={!admin || isSaving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Shop / Business Name */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Shop Name / Business Entity
          </label>
          <input
            type="text"
            value={formData.shopname}
            onChange={(e) => handleChange("shopname", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="Shop or Business Name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Account Status */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Account Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => handleChange("status", e.target.value)}
            disabled={!admin || isSaving}
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Operating Address */}
        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Address</label>
          <textarea
            rows={2}
            value={formData.address}
            onChange={(e) => handleChange("address", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="Enter complete address"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* City */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">City</label>
          <input
            type="text"
            value={formData.city}
            onChange={(e) => handleChange("city", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="City"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* State */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">State</label>
          <input
            type="text"
            value={formData.state}
            onChange={(e) => handleChange("state", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="State"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
          />
        </div>

        {/* Pincode */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pincode</label>
          <input
            type="text"
            maxLength={6}
            value={formData.pincode}
            onChange={(e) => handleChange("pincode", e.target.value)}
            disabled={!admin || isSaving}
            placeholder="6-digit PIN code"
            className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 font-mono"
          />
        </div>

        {/* PAN Number (Verified from KYC) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">PAN Number</label>
            {panRecord && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {prettyKycText(panRecord.status)}
              </span>
            )}
          </div>
          <input
            type="text"
            readOnly
            value={panRecord?.masked_identifier || "Not verified yet"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 font-mono cursor-not-allowed"
          />
        </div>

        {/* Aadhaar Number (Verified from KYC) */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-700">Aadhaar Number</label>
            {aadhaarRecord && (
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {prettyKycText(aadhaarRecord.status)}
              </span>
            )}
          </div>
          <input
            type="text"
            readOnly
            value={aadhaarRecord?.masked_identifier || "Not verified yet"}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 font-mono cursor-not-allowed"
          />
        </div>
      </div>

      {admin && (
        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <Button
            type="submit"
            disabled={isSaving}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-6 py-2.5 rounded-xl shadow-xs"
          >
            {isSaving && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {isSaving ? "Saving Changes..." : "Save Profile Details"}
          </Button>
        </div>
      )}
    </form>
  );
}

export default ProfileDetailsTab;
