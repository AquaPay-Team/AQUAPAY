import React from "react";
import { Link } from "react-router-dom";

const prettyKycText = (value) =>
  value == null || value === ""
    ? "—"
    : String(value).replaceAll("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());

export function UserProfileHeader({
  profile,
  roleMeta,
  status,
  admin,
  directoryHref,
  onOpenKycTab,
}) {
  return (
    <div>
      {directoryHref && (
        <Link
          to={directoryHref}
          className="inline-block text-xs font-semibold text-blue-700 hover:text-blue-900 mb-3"
        >
          ← Back to directory
        </Link>
      )}

      {/* User Card Header matching reference UI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-xl flex items-center justify-center shadow-xs shrink-0">
            {profile.name?.charAt(0)?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{profile.name || "AquaPay Member"}</span>
              <span className="text-slate-400 font-mono font-normal text-sm">
                ({profile.id})
              </span>
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              {profile.mobile} · {profile.shopname || profile.name || "Business"}
            </p>
            <div className="mt-2.5 flex items-center gap-2.5">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border capitalize ${
                  status === "approved"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : status === "rejected"
                    ? "bg-rose-50 text-rose-700 border-rose-200"
                    : "bg-amber-50 text-amber-700 border-amber-200"
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                KYC{" "}
                {status === "approved"
                  ? "Approved"
                  : status === "rejected"
                  ? "Rejected"
                  : prettyKycText(status)}
              </span>
              {status !== "approved" && admin && (
                <button
                  type="button"
                  onClick={onOpenKycTab}
                  className="px-3.5 py-1 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-2xs transition cursor-pointer"
                >
                  View &amp; Verify KYC
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex sm:flex-col items-start sm:items-end gap-1 text-xs text-slate-400 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-100">
          <span className="font-semibold text-slate-700">{roleMeta?.name || "Partner"}</span>
          <span>
            Account:{" "}
            <strong
              className={
                profile.status === "active" ? "text-emerald-600" : "text-slate-500"
              }
            >
              {profile.status || "active"}
            </strong>
          </span>
        </div>
      </div>
    </div>
  );
}

export default UserProfileHeader;
