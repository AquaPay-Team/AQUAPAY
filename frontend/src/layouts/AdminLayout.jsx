import React, { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "@/features/admin/components/AdminSidebar";
import { AdminHeader } from "@/features/admin/components/AdminHeader";
import { CommandSearchModal } from "@/features/admin/modals/CommandSearchModal";

/**
 * Admin Layout Shell
 * Provides the sidebar, header, global command search, and an <Outlet />
 * for genuine nested routing under /admin/*.
 */
export function AdminLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showCommandModal, setShowCommandModal] = useState(false);
  const [cmdSearchQuery, setCmdSearchQuery] = useState("");

  // Global Ctrl+K shortcut for command search modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandModal((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      {/* Admin Sidebar Navigation */}
      <AdminSidebar
        sidebarCollapsed={sidebarCollapsed}
        setSidebarCollapsed={setSidebarCollapsed}
        mobileSidebarOpen={mobileSidebarOpen}
        setMobileSidebarOpen={setMobileSidebarOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ${
          sidebarCollapsed ? "md:ml-20" : "md:ml-72"
        }`}
      >
        {/* Top Header */}
        <AdminHeader
          sidebarCollapsed={sidebarCollapsed}
          setSidebarCollapsed={setSidebarCollapsed}
          setMobileSidebarOpen={setMobileSidebarOpen}
        />

        {/* Dynamic Nested Route View */}
        <main className="p-4 md:p-6 lg:p-8 flex-1">
          <Outlet />
        </main>
      </div>

      {/* Global Quick Search Modal */}
      <CommandSearchModal
        showCommandModal={showCommandModal}
        setShowCommandModal={setShowCommandModal}
        cmdSearchQuery={cmdSearchQuery}
        setCmdSearchQuery={setCmdSearchQuery}
      />
    </div>
  );
}

export default AdminLayout;
