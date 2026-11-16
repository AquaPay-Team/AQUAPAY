import React, { useState, useEffect, useRef, useCallback } from "react";
import { Menu, LogOut, CheckCircle2, Search, CreditCard, Bell, User, X } from "lucide-react";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "sonner";
import { getRoleMeta } from "../../constants/roles";

// ─── Notification helpers (localStorage-backed until real API) ────────────────
const NOTIF_STORAGE_KEY = "aquapay_notifications";
const NOTIF_SEEN_KEY = "aquapay_notif_last_seen";

function getStoredNotifications() {
  try {
    const raw = localStorage.getItem(NOTIF_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}

  // First-time seed: one real welcome notification
  const user = (() => {
    try { return JSON.parse(localStorage.getItem("user") || "{}"); } catch { return {}; }
  })();

  const seed = [
    {
      id: "notif-welcome-1",
      title: `Welcome, ${user.name || "User"}!`,
      body: "Your account is active. Complete KYC to unlock all services.",
      icon: "success",
      timestamp: new Date().toISOString(),
    },
  ];
  localStorage.setItem(NOTIF_STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function getUnseenCount(notifications) {
  const lastSeen = localStorage.getItem(NOTIF_SEEN_KEY) || "1970-01-01T00:00:00Z";
  return notifications.filter((n) => new Date(n.timestamp) > new Date(lastSeen)).length;
}

function markAllSeen() {
  localStorage.setItem(NOTIF_SEEN_KEY, new Date().toISOString());
}

// ─── Component ────────────────────────────────────────────────────────────────
export function DashboardHeader({
  collapsed,
  setCollapsed,
  setMobileOpen,
}) {
  const navigate = useNavigate();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef(null);
  const headerSearchRef = useRef(null);

  const [notifications, setNotifications] = useState(() => getStoredNotifications());
  const [unseenCount, setUnseenCount] = useState(() => getUnseenCount(getStoredNotifications()));

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

  const roleMeta = getRoleMeta(currentUser) || {
    name: currentUser.role_name || "Partner",
  };

  // Searchable pages
  const searchablePages = [
    { label: "Dashboard", path: "/user/dashboard", keywords: "home overview main" },
    { label: "KYC Verification", path: "/user/kyc", keywords: "kyc aadhaar pan identity verify" },
    { label: "My Team", path: "/user/team", keywords: "team agents downline hierarchy" },
    { label: "My Profile", path: "/user/profile", keywords: "profile account name email" },
    { label: "Settings", path: "/user/settings", keywords: "settings preferences" },
  ];

  const filteredPages = searchQuery.trim()
    ? searchablePages.filter(
        (p) =>
          p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.keywords.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : searchablePages;

  // Ctrl+K handler
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
    }
    if (e.key === "Escape") {
      setSearchOpen(false);
      setSearchQuery("");
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Auto-focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [searchOpen]);

  // Focus on header search bar click
  const handleHeaderSearchClick = () => {
    setSearchOpen(true);
  };

  // Open notification → mark as seen
  const handleOpenNotifications = () => {
    const next = !notificationOpen;
    setNotificationOpen(next);
    setUserMenuOpen(false);
    if (next) {
      markAllSeen();
      setUnseenCount(0);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("user");
    localStorage.removeItem("adminUser");
    toast.info("Signed out successfully");
    navigate("/login/user", { replace: true });
  };

  const timeAgo = (isoDate) => {
    const diff = Date.now() - new Date(isoDate).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <header className="h-[68px] bg-white border-b border-slate-200 sticky top-0 z-30 px-4 md:px-6 flex items-center justify-between shadow-2xs relative">
        {/* Left: Sidebar Toggle & Search Bar */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden md:flex p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Toggle Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            title="Open Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Global Search Bar (opens Ctrl+K modal on click) */}
          <button
            ref={headerSearchRef}
            onClick={handleHeaderSearchClick}
            className="relative hidden sm:flex items-center gap-2 pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs w-64 md:w-80 text-slate-400 hover:border-slate-300 hover:bg-white transition-all cursor-pointer text-left"
          >
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <span>Search...</span>
            <kbd className="ml-auto text-[10px] font-semibold bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded">
              Ctrl K
            </kbd>
          </button>
        </div>

        {/* Right: Wallet Balance, Notifications & User Avatar */}
        <div className="flex items-center gap-3">
          {/* Wallet Balance Pill */}
          <div className="flex items-center gap-2 border border-blue-600 bg-white hover:bg-blue-50/50 text-blue-600 font-bold px-3.5 py-2 rounded-xl text-xs transition shadow-2xs cursor-pointer">
            <CreditCard className="w-4 h-4 text-black" />
            <span>₹ 0.00</span>
          </div>

          {/* Notification Bell — real unseen count */}
          <div className="relative">
            <button
              onClick={handleOpenNotifications}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors relative cursor-pointer"
              title="Notifications"
            >
              <Bell className="w-[18px] h-[18px] text-black" />
              {unseenCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-blue-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center animate-pulse">
                  {unseenCount}
                </span>
              )}
            </button>

            {/* Notification Popover */}
            {notificationOpen && (
              <div className="absolute right-0 top-14 w-80 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 z-50">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-slate-900 text-sm">Notifications</span>
                  <span className="text-[10px] text-slate-400 font-medium">
                    {notifications.length} total
                  </span>
                </div>
                {notifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No notifications yet
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                    {notifications.map((notif) => (
                      <div key={notif.id} className="py-3 flex items-start gap-3">
                        <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                          <CheckCircle2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-xs">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-800 leading-snug">
                              {notif.title}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">
                              {timeAgo(notif.timestamp)}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-0.5">{notif.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => setNotificationOpen(false)}
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile Avatar */}
          <div className="relative">
            <button
              onClick={() => {
                setUserMenuOpen(!userMenuOpen);
                setNotificationOpen(false);
              }}
              className="flex items-center gap-2 cursor-pointer focus:outline-none"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 border border-blue-200 text-blue-700 font-bold flex items-center justify-center text-sm overflow-hidden shadow-2xs">
                {currentUser.name ? currentUser.name.charAt(0).toUpperCase() : "U"}
              </div>
            </button>

            {/* User Profile Dropdown Menu */}
            {userMenuOpen && (
              <div className="absolute right-0 top-14 w-56 bg-white rounded-2xl shadow-xl border border-slate-200 p-2 z-50 text-xs">
                <div className="px-3 py-2 border-b border-slate-100 mb-1">
                  <span className="font-bold text-slate-900 block truncate">
                    {currentUser.name || "Member"}
                  </span>
                  <span className="text-[10px] text-blue-600 font-semibold uppercase">
                    {roleMeta.name} Terminal
                  </span>
                </div>
                <Link
                  to="/user/profile"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <User className="w-4 h-4 text-black" />
                  <span>My Profile</span>
                </Link>
                <Link
                  to="/user/kyc"
                  onClick={() => setUserMenuOpen(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>KYC Verification</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-600 hover:bg-rose-50 transition-colors mt-1 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Ctrl+K Search Modal ─────────────────────────────────────── */}
      {searchOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[15vh]"
          onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
        >
          <div
            className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search pages, services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && filteredPages.length > 0) {
                    navigate(filteredPages[0].path);
                    setSearchOpen(false);
                    setSearchQuery("");
                  }
                }}
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
              />
              <button
                onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results */}
            <div className="max-h-72 overflow-y-auto py-2">
              {filteredPages.length === 0 ? (
                <div className="px-5 py-8 text-center text-slate-400 text-sm">
                  No results found for "{searchQuery}"
                </div>
              ) : (
                filteredPages.map((page) => (
                  <button
                    key={page.path}
                    onClick={() => {
                      navigate(page.path);
                      setSearchOpen(false);
                      setSearchQuery("");
                    }}
                    className="w-full flex items-center gap-3 px-5 py-3 text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                  >
                    <Search className="w-4 h-4 text-slate-400 shrink-0" />
                    <span className="font-medium">{page.label}</span>
                  </button>
                ))
              )}
            </div>

            {/* Footer hint */}
            <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] text-slate-400">
              <span>↵ to select · Esc to close</span>
              <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] font-semibold">Ctrl K</kbd>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DashboardHeader;