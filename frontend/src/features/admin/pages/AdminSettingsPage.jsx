import React from "react";
import { Settings } from "lucide-react";

const panel = "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-2xs";

export default function AdminSettingsPage() {
  return (
    <section className="mx-auto max-w-7xl space-y-5 pb-10">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-slate-400">
            <span>Admin</span>
            <span>/</span>
            <span className="font-semibold text-slate-700">Settings</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-xs text-slate-500">
            Admin console settings are not yet implemented.
          </p>
        </div>
      </div>

      <div className={panel}>
        <div className="flex items-start justify-between gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
            <Settings className="h-5 w-5 shrink-0" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-slate-900">To Be Implemented</h2>
            <p className="mt-1 text-xs text-slate-500">
              The Settings page is a placeholder and will be implemented in an upcoming release.
            </p>
          </div>
        </div>
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
          <p className="font-semibold text-slate-800">No configurable options available yet.</p>
          <p className="mt-1">
            Check back later for admin preference, notification, and system configuration settings.
          </p>
        </div>
      </div>
    </section>
  );
}
