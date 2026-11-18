import React, { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { User, Mail, Phone, Store, MapPin, ShieldCheck, Building, KeyRound } from "lucide-react";
import { getCurrentUser } from "../../api/auth.api";
import { fetchBackendUserById } from "../../features/admin/services/adminApi";
import { getRoleMeta } from "../../constants/roles";
import { useAuth } from "../../context/AuthContext";
import PasswordUpdateForm from "../../features/auth/components/PasswordUpdateForm";
import { Button } from "../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/dialog";

function responseData(response) {
  return response?.data?.data || response?.data || response;
}

export default function UserProfile({ targetUserId }) {
  const params = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const id = targetUserId || params.id;
  const { user: authenticatedUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = id ? await fetchBackendUserById(id) : await getCurrentUser();
      setProfile(responseData(response));
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Could not load this profile.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  if (loading) return <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 border border-slate-200 text-sm text-slate-500">Loading profile…</div>;
  if (error || !profile) return <div role="alert" className="max-w-4xl mx-auto bg-white rounded-2xl p-6 border border-rose-200 text-sm text-rose-700">{error || "Profile not found."}</div>;

  const roleMeta = getRoleMeta(profile) || { name: profile.role_name || "Partner" };
  const status = String(profile.kyc?.status || "pending").toLowerCase();
  const ownProfile = !id || String(authenticatedUser?.id) === String(profile.id);
  const admin = Number(authenticatedUser?.role_id) === 1;
  const directoryBase = location.pathname.startsWith("/admin/users/")
    ? "/admin/users"
    : location.pathname.startsWith("/user/team/")
      ? "/user/team"
      : "";
  const directoryRoleId = searchParams.get("roleId");
  const directoryHref = directoryBase
    ? `${directoryBase}${directoryRoleId ? `?roleId=${encodeURIComponent(directoryRoleId)}` : ""}`
    : "";

  const details = [
    [Mail, "Email Address", profile.email],
    [Phone, "Mobile Number", profile.mobile],
    [Store, "Business / Shop", profile.shopname],
    [MapPin, "Operating Address", profile.address],
    [Building, "City / State", [profile.city, profile.state, profile.pincode].filter(Boolean).join(", ")],
    [User, "Parent / Sponsor", profile.parent_name],
    [Building, "Company", profile.company_name],
    [Building, "Account Created", profile.created_at ? new Date(profile.created_at).toLocaleDateString() : null],
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        {directoryHref && <Link to={directoryHref} className="inline-block text-xs font-semibold text-blue-700 hover:text-blue-900 mb-3">Back to directory</Link>}
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{ownProfile ? "My Account Profile" : "User Profile"}</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">Profile details from the AquaPay account record</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-100 gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-2xl flex items-center justify-center shadow-sm">
              {profile.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">{profile.name || "AquaPay Member"}</h2>
              <p className="text-xs text-slate-500 mt-0.5 font-mono">Partner ID: #{profile.id} · {roleMeta.name}</p>
              <p className="text-xs text-slate-500 mt-1">Account: {profile.status || "active"}</p>
            </div>
          </div>
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700">
            <ShieldCheck className="w-4 h-4" /> KYC: {status.replaceAll("_", " ")}
            {profile.kyc?.steps_completed !== undefined && <span>· {profile.kyc.steps_completed} steps</span>}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-xs">
          {details.map(([Icon, label, value]) => (
            <div key={label} className="space-y-1">
              <span className="text-slate-400 font-medium flex items-center gap-1.5"><Icon className="w-3.5 h-3.5" />{label}</span>
              <span className="font-semibold text-slate-800 text-sm block">{value || "Not provided"}</span>
            </div>
          ))}
          <div className="space-y-1">
            <span className="text-slate-400 font-medium flex items-center gap-1.5"><Building className="w-3.5 h-3.5" />Business Constitution</span>
            <span className="font-semibold text-slate-800 text-sm block">{profile.kyc?.business_type || "Not provided"}</span>
          </div>
        </div>
      </div>

      {ownProfile && <PasswordUpdateForm />}
      {!ownProfile && admin && Number(profile.role_id) !== 1 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs">
          <Button type="button" onClick={() => setResetDialogOpen(true)} className="bg-blue-600 text-white hover:bg-blue-700">
            <KeyRound className="w-4 h-4" /> Reset Password
          </Button>
        </div>
      )}

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>Set a new password for this account.</DialogDescription>
          </DialogHeader>
          <PasswordUpdateForm
            targetUserId={profile.id}
            compact
            onSuccess={() => setResetDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
