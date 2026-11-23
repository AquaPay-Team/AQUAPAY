import React, { useState } from 'react';
import {
  Menu,
  Bell,
  CheckCircle2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth';

export function AdminHeader({
  sidebarCollapsed,
  setSidebarCollapsed,
  setMobileSidebarOpen,
}) {
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const { user } = useAuth();

  const adminName = user?.name || "Administrator";
  const initials =
    adminName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "AD";

  return (
    <header className="h-[68px] bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-2xs relative">
      {/* Left: Sidebar Toggle */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Toggle Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Open Navigation"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Right: Quick Actions & Admin Profile */}
      <div className="flex items-center gap-3">
        {/* Notification Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setNotificationOpen(!notificationOpen);
            }}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
            title="Notifications"
          >
            <Bell className="w-5 h-5 text-black" />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-600 rounded-full ring-2 ring-white animate-pulse" />
          </button>

          {/* Notifications Dropdown Panel */}
          {notificationOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 p-4 z-50 animate-in fade-in slide-in-from-top-2 ">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="font-bold text-slate-800">System Notifications</span>
              </div>
              <div className="py-3 space-y-2.5">
                <div className="flex items-start gap-2.5 p-2 rounded-xl bg-slate-50 hover:bg-slate-100/70 transition-colors cursor-pointer">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                   <div className="text-xs font-semibold text-slate-800">
                   View live API and dependency readiness in Server & Reports.
                  </div>
                </div>
              </div>
              </div>
              </div>
          )}
          </div>
        {/* User Profile Dropdown */}
       <button
          onClick={() => navigate("/admin/profile")}
          className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer group text-left"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs shadow-2xs group-hover:scale-105 transition-transform">
            {initials}
          </div>
          <div className="hidden md:block text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight">
              {adminName}
            </div>
            <div className="text-[10px] text-slate-400 font-medium capitalize">
              {user?.role_name || "Admin"}
            </div>
          </div>
        </button>
      </div>
    </header>
  );
}
export default AdminHeader;
