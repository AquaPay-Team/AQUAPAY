import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useParams, useSearchParams } from "react-router-dom";
import { User, Layers, Shield, BadgeCheck, Lock, Network, Smartphone, } from "lucide-react";
import { getCurrentUser } from "@/api/auth.api";
import { fetchBackendUserById } from "@/features/users/api/usersApi";
import { getRoleMeta } from "@/constants/roles";
import { useAuth } from "@/features/auth";
import PasswordUpdateForm from "@/features/auth/components/PasswordUpdateForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAdminKycDetailsByUserId } from "@/features/admin/services/adminKycApi";
import { getKycStatus } from "@/api/kyc.api";
import { parseApiError } from "@/lib/errors";

// Modular profile tab sub-components
import {
  UserProfileHeader,
  ProfileDetailsTab,
  SchemesTab,
  SecurityTab,
  KycUploadTab,
  WalletLockTab,
  ParentMappingTab,
  DeviceMappingTab,
} from "../components/profile-tabs";

function responseData(response) {
  return response?.data?.data || response?.data || response;
}

export default function UserProfile({ targetUserId }) {
  const params = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const id = targetUserId || params.id;
  const { user: authenticatedUser } = useAuth();
  const admin = Number(authenticatedUser?.role_id) === 1;
  const ownProfile = !id || String(authenticatedUser?.id) === String(id);

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [resetDialogOpen, setResetDialogOpen] = useState(false);

  // KYC Management State
  const [kycData, setKycData] = useState(null);
  const [kycLoading, setKycLoading] = useState(false);
  const [kycError, setKycError] = useState("");

  // Tab State & Synchronization with URL Query Parameters
  const initialTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(initialTab);

  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam) {
      if (!admin && !["profile", "security"].includes(tabParam)) {
        setActiveTab("profile");
      } else {
        setActiveTab((prev) => (tabParam !== prev ? tabParam : prev));
      }
    } else if (!admin && !["profile", "security"].includes(activeTab)) {
      setActiveTab("profile");
    }
  }, [searchParams, admin, activeTab]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    const newParams = new URLSearchParams(searchParams);
    newParams.set("tab", tabId);
    setSearchParams(newParams, { replace: true });
  };

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

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadKycDetails = useCallback(async () => {
    if (!id && !ownProfile) return;
    setKycLoading(true);
    setKycError("");
    try {
      if (admin && id) {
        const data = await getAdminKycDetailsByUserId(id);
        setKycData(data);
      } else {
        const statusRes = await getKycStatus();
        const kycStatusPayload = statusRes?.data || statusRes;
        if (kycStatusPayload) {
          const verifications = [];
          if (kycStatusPayload.aadhaar) {
            verifications.push({
              verification_type: "aadhaar",
              status: "verified",
              masked_identifier: kycStatusPayload.aadhaar.maskedIdentifier,
            });
          }
          if (kycStatusPayload.pan) {
            verifications.push({
              verification_type: "pan",
              status: "verified",
              masked_identifier: kycStatusPayload.pan.maskedIdentifier,
            });
          }
          setKycData({
            status: kycStatusPayload.status,
            verifications,
          });
        }
      }
    } catch (err) {
      if (err?.response?.status === 404) {
        setKycData(null);
      } else {
        setKycError(parseApiError(err).message || "Could not load KYC details.");
      }
    } finally {
      setKycLoading(false);
    }
  }, [id, admin, ownProfile]);

  // Always load KYC dossier when viewing profile so Aadhaar & PAN are available across tabs
  useEffect(() => {
    if ((id && admin) || ownProfile) {
      loadKycDetails();
    }
  }, [id, admin, ownProfile, loadKycDetails]);

  const ADMIN_TABS = [
    { id: "profile", label: "Profile", icon: User },
    { id: "schemes", label: "Schemes", icon: Layers },
    { id: "security", label: "Security", icon: Shield },
    { id: "kyc", label: "KYC Upload", icon: BadgeCheck, badge: profile?.kyc?.status },
    { id: "wallet-lock", label: "Wallet Lock", icon: Lock },
    { id: "parent-mapping", label: "Parent Mapping", icon: Network },
    { id: "device-mapping", label: "Device Mapping", icon: Smartphone },
  ];

  const USER_TABS = [
    { id: "profile", label: "User Details", icon: User },
    { id: "security", label: "Password Update", icon: Lock },
  ];

  const TABS = admin ? ADMIN_TABS : USER_TABS;

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto bg-white rounded-2xl p-6 border border-slate-200 text-sm text-slate-500">
        Loading profile…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div
        role="alert"
        className="max-w-4xl mx-auto bg-white rounded-2xl p-6 border border-rose-200 text-sm text-rose-700"
      >
        {error || "Profile not found."}
      </div>
    );
  }

  const roleMeta = getRoleMeta(profile) || { name: profile.role_name || "Partner" };
  const status = String(profile.kyc?.status || "pending").toLowerCase();

  const directoryBase = location.pathname.startsWith("/admin/users/")
    ? "/admin/users"
    : location.pathname.startsWith("/user/team/")
      ? "/user/team"
      : "";
  const directoryRoleId = searchParams.get("roleId");
  const directoryHref = directoryBase
    ? `${directoryBase}${directoryRoleId ? `?roleId=${encodeURIComponent(directoryRoleId)}` : ""}`
    : "";

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* ── Top Header & Breadcrumb ───────────────────────────────────── */}
      <UserProfileHeader
        profile={profile}
        roleMeta={roleMeta}
        status={status}
        admin={admin}
        directoryHref={directoryHref}
        onOpenKycTab={() => handleTabChange("kyc")}
      />

      {/* ── 7-Tab Navigation Bar ────────────────────────────────────────── */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 scrollbar-none">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${isActive
                ? "bg-blue-600 text-white shadow-2xs"
                : "bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200/80"
                }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${isActive ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"
                    }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Panels (Modular Sub-Components) ─────────────────────────── */}
      {activeTab === "profile" && (
        <ProfileDetailsTab
          userId={id}
          profile={profile}
          admin={admin}
          kycData={kycData}
          onProfileUpdated={loadProfile}
        />
      )}

      {admin && activeTab === "schemes" && <SchemesTab />}

      {activeTab === "security" && (
        <SecurityTab
          ownProfile={ownProfile}
          admin={admin}
          profile={profile}
          onOpenResetDialog={() => setResetDialogOpen(true)}
        />
      )}

      {admin && activeTab === "kyc" && (
        <KycUploadTab
          kycData={kycData}
          kycLoading={kycLoading}
          kycError={kycError}
          loadKycDetails={loadKycDetails}
          admin={admin}
          onKycUpdated={() => {
            loadKycDetails();
            loadProfile();
          }}
        />
      )}

      {admin && activeTab === "wallet-lock" && <WalletLockTab />}

      {admin && activeTab === "parent-mapping" && <ParentMappingTab profile={profile} />}

      {admin && activeTab === "device-mapping" && <DeviceMappingTab />}

      {/* ── Password Reset Modal ────────────────────────────────────────── */}
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
