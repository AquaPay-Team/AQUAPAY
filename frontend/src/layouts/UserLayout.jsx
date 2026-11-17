import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { UserSidebar } from "../components/user/UserSidebar";
import { DashboardHeader } from "../components/common/DashboardHeader";

export function UserLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleUserUpdate = (e) => {
      try {
        const fresh = e?.detail || JSON.parse(localStorage.getItem("user") || "{}");
        setCurrentUser(fresh);
      } catch {}
    };
    window.addEventListener("aquapay:user_updated", handleUserUpdate);
    window.addEventListener("storage", handleUserUpdate);
    return () => {
      window.removeEventListener("aquapay:user_updated", handleUserUpdate);
      window.removeEventListener("storage", handleUserUpdate);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-slate-800 antialiased">
      {/* Dynamic Normal User Sidebar */}
      <UserSidebar
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          collapsed ? "md:ml-20" : "md:ml-72"
        }`}
      >
        <DashboardHeader
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          setMobileOpen={setMobileOpen}
        />

        <main className="p-4 md:p-6 lg:p-8 flex-1">
          <Outlet />
        </main>
      </div>

    </div>
  );
}

export default UserLayout;
