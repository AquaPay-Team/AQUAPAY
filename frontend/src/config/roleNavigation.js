/**
 * Centralized Role-Based Navigation Configuration
 * Maps directly to backend role hierarchy:
 * 1: AD (Admin)
 * 2: SA (Sub Admin)
 * 3: NSM (NSM)
 * 4: SH (State Head)
 * 5: CNF (CNF / CHF)
 * 6: MD (Master Distributor)
 * 7: DT (Distributor)
 * 8: RT (Retailer)
 */

export const ROLE_NAVIGATION = {
  // Admin Navigation (Exclusively for Role 1 / AD)
  AD: [
    {
      id: "admin-dashboard",
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "admin-users",
      label: "User Management",
      icon: "Users",
      children: [
        {
          id: "admin-all-users",
          label: "All Users",
          path: "/admin/users",
          icon: "Users",
        },
        {
          id: "admin-create-user",
          label: "Create User",
          path: "/admin/users/create",
          icon: "UserPlus",
        },
      ],
    },
    {
      id: "admin-kyc",
      label: "KYC Management",
      path: "/admin/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "admin-reports",
      label: "Server & Reports",
      path: "/admin/reports",
      icon: "BarChart3",
    },
    {
      id: "admin-profile",
      label: "My Profile",
      path: "/admin/profile",
      icon: "User",
    },
    {
      id: "admin-settings",
      label: "Settings",
      path: "/admin/settings",
      icon: "Settings",
    },
  ],

  // Sub Admin Navigation (Level 1)
  SA: [
    {
      id: "sa-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "sa-team",
      label: "Downline Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "sa-all-agents",
          label: "My Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "sa-create-agent",
          label: "Create Agent",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "sa-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "sa-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "sa-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // NSM Navigation (Level 2)
  NSM: [
    {
      id: "nsm-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "nsm-team",
      label: "National Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "nsm-all-agents",
          label: "My Team",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "nsm-create-agent",
          label: "Onboard Agent",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "nsm-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "nsm-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "nsm-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // State Head Navigation (Level 3)
  SH: [
    {
      id: "sh-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "sh-team",
      label: "State Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "sh-all-agents",
          label: "State Team",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "sh-create-agent",
          label: "Onboard Agent",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "sh-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "sh-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "sh-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // CNF / CHF Navigation (Level 4)
  CNF: [
    {
      id: "cnf-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "cnf-team",
      label: "Territory Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "cnf-all-agents",
          label: "Territory Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "cnf-create-agent",
          label: "Onboard Agent",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "cnf-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "cnf-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "cnf-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // Master Distributor Navigation (Level 5)
  MD: [
    {
      id: "md-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "md-team",
      label: "My Distributors",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "md-dist-list",
          label: "Distributors List",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "md-create-dist",
          label: "Create Distributor",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "md-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "md-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "md-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // Distributor Navigation (Level 6)
  DT: [
    {
      id: "dt-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "dt-team",
      label: "My Retailers",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "dt-retailer-list",
          label: "Retailers List",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "dt-create-retailer",
          label: "Create Retailer",
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: "dt-kyc",
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: "dt-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "dt-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],

  // Retailer Navigation (Level 7) - Dedicated Merchant Terminal
  RT: [
    {
      id: "rt-dashboard",
      label: "Terminal Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "rt-kyc",
      label: "My KYC Verification",
      path: "/user/kyc",
      icon: "ShieldCheck",
      children: [
        {
          id: "rt-kyc-status",
          label: "Verification Overview",
          path: "/user/kyc",
          icon: "ShieldCheck",
        },
        {
          id: "rt-kyc-basic",
          label: "Business Details",
          path: "/user/kyc/basic-details",
          icon: "Store",
        },
        {
          id: "rt-kyc-bank",
          label: "Bank Details",
          path: "/user/kyc/bank-details",
          icon: "Building2",
        },
        {
          id: "rt-kyc-agreement",
          label: "Merchant Agreement",
          path: "/user/kyc/agreement",
          icon: "FileSignature",
        },
      ],
    },
    {
      id: "rt-profile",
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: "rt-settings",
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ],
};

/**
 * Resolves the role slug from user object or string and returns its navigation items
 */
export function getRoleNavigation(userOrRole) {
  if (!userOrRole) return ROLE_NAVIGATION.RT;

  let slug = "";
  if (typeof userOrRole === "object") {
    slug = String(
      userOrRole.role_slug || userOrRole.slug || ""
    ).trim().toUpperCase();

    if (!slug && userOrRole.role_id) {
      const idMap = {
        1: "AD",
        2: "SA",
        3: "NSM",
        4: "SH",
        5: "CNF",
        6: "MD",
        7: "DT",
        8: "RT",
      };
      slug = idMap[Number(userOrRole.role_id)] || "RT";
    }
  } else {
    slug = String(userOrRole).trim().toUpperCase();
  }

  // Handle aliases like 'ADMIN' -> 'AD', 'RETAILER' -> 'RT'
  if (slug === "ADMIN" || slug === "SUPER ADMIN") slug = "AD";
  if (slug === "SUB ADMIN") slug = "SA";
  if (slug === "STATE HEAD") slug = "SH";
  if (slug === "CHF") slug = "CNF";
  if (slug === "MASTER DISTRIBUTOR") slug = "MD";
  if (slug === "DISTRIBUTOR") slug = "DT";
  if (slug === "RETAILER") slug = "RT";

  return ROLE_NAVIGATION[slug] || ROLE_NAVIGATION.RT;
}

export default ROLE_NAVIGATION;
