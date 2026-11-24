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

// Helper to generate downline network hierarchy cleanly
function createDownlineNav(prefix, teamLabel, agentsLabel, createLabel = "Onboard Agent", allId, createId) {
  return [
    {
      id: `${prefix}-dashboard`,
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: `${prefix}-team`,
      label: teamLabel,
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: allId || `${prefix}-all-agents`,
          label: agentsLabel,
          path: "/user/team",
          icon: "Users",
        },
        {
          id: createId || `${prefix}-create-agent`,
          label: createLabel,
          path: "/user/team/create",
          icon: "UserPlus",
          permission: "canCreateUsers",
        },
      ],
    },
    {
      id: `${prefix}-kyc`,
      label: "KYC Status",
      path: "/user/kyc",
      icon: "ShieldCheck",
    },
    {
      id: `${prefix}-profile`,
      label: "My Profile",
      path: "/user/profile",
      icon: "User",
    },
    {
      id: `${prefix}-settings`,
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ];
}

export const ROLE_NAVIGATION = {
  // Admin Navigation (Exclusively for Role 1 / AD)
  AD: [
    {
      id: "admin-dashboard",
      label: "Dashboard",
      path: "/admin/dashboard",
      icon: "LayoutDashboard",
    },
    { id: "admin-roles", isDynamicRoles: true },
    {
      id: "admin-reports",
      label: "Server & Reports",
      path: "/admin/reports",
      icon: "BarChart3",
    },
    {
      id: "admin-settings",
      label: "Settings",
      path: "/admin/settings",
      icon: "Settings",
    },
  ],

  // Sub Admin Navigation (Level 1)
  SA: createDownlineNav("sa", "Downline Network", "My Agents", "Create Agent"),

  // NSM Navigation (Level 2)
  NSM: createDownlineNav("nsm", "National Network", "My Team", "Onboard Agent"),

  // State Head Navigation (Level 3)
  SH: createDownlineNav("sh", "State Network", "State Team", "Onboard Agent"),

  // CNF / CHF Navigation (Level 4)
  CNF: createDownlineNav("cnf", "Territory Network", "Territory Agents", "Onboard Agent"),

  // Master Distributor Navigation (Level 5)
  MD: createDownlineNav("md", "My Distributors", "Distributors List", "Create Distributor", "md-dist-list", "md-create-dist"),

  // Distributor Navigation (Level 6)
  DT: createDownlineNav("dt", "My Retailers", "Retailers List", "Create Retailer", "dt-retailer-list", "dt-create-retailer"),

  // Retailer Navigation (Level 7) - Dedicated Merchant Terminal
  RT: [
    {
      id: "rt-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    { id: "rt-roles", isDynamicRoles: true },
    {
      id: "rt-fund",
      label: "Fund",
      icon: "Wallet",
      children: [
        {
          id: "rt-fund-transfer",
          label: "Transfer/Return",
          path: "/user/fund/transfer-return",
          icon: "Send",
        },
        {
          id: "rt-fund-report",
          label: "Transfer Return Report",
          path: "/user/fund/transfer-return-report",
          icon: "FileText",
        },
      ],
    },
    {
      id: "rt-services",
      label: "Services",
      icon: "Zap",
      children: [
        {
          id: "rt-services-add-money",
          label: "Add Money",
          path: "/user/services/add-money",
          icon: "Zap",
        },
        {
          id: "rt-services-cc-bill",
          label: "Credit Card Bill 2",
          path: "/user/services/credit-card-bill",
          icon: "CreditCard",
        },
        {
          id: "rt-services-payout",
          label: "Payout",
          path: "/user/services/payout",
          icon: "Send",
        },
        {
          id: "rt-services-rupay-upi",
          label: "RupayUpi",
          path: "/user/services/rupay-upi",
          icon: "QrCode",
        },
      ],
    },
    {
      id: "rt-reports",
      label: "Transaction Report",
      icon: "FileText",
      children: [
        {
          id: "rt-reports-all",
          label: "All Transaction Report",
          path: "/user/dashboard",
          icon: "FileText",
        },
        {
          id: "rt-reports-payout",
          label: "Payout Report",
          path: "/user/reports/payout",
          icon: "FileText",
        },
        {
          id: "rt-reports-cc-offline",
          label: "Creditcard Offline Report",
          path: "/user/reports/creditcard-offline",
          icon: "FileText",
        },
        {
          id: "rt-reports-cc-payment",
          label: "Creditcard Payment Report",
          path: "/user/reports/creditcard-payment",
          icon: "FileText",
        },
        {
          id: "rt-reports-pg",
          label: "Payment Gateway Report",
          path: "/user/reports/pg",
          icon: "FileText",
        },
        {
          id: "rt-reports-pos",
          label: "POS Report",
          path: "/user/reports/pos",
          icon: "FileText",
        },
        {
          id: "rt-reports-pos-request",
          label: "POS Request Report",
          path: "/user/reports/pos-request",
          icon: "FileText",
        },
      ],
    },
    {
      id: "rt-statement",
      label: "Account Statement",
      path: "/user/statement",
      icon: "Landmark",
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

  if (slug !== "AD") {
    const items = [
      { id: `${slug.toLowerCase()}-dashboard`, label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
      { id: `${slug.toLowerCase()}-roles`, isDynamicRoles: true },
    ];

    if (slug === "RT") {
      return [
        ...items,
        ...ROLE_NAVIGATION.RT.filter((item) => item.id.startsWith("rt-") && item.id !== "rt-dashboard" && item.id !== "rt-roles"),
      ];
    }

    return [
      ...items,
      { id: `${slug.toLowerCase()}-settings`, label: "Settings", path: "/user/settings", icon: "Settings" },
    ];
  }

  return ROLE_NAVIGATION[slug] || ROLE_NAVIGATION.RT;
}

export default ROLE_NAVIGATION;
