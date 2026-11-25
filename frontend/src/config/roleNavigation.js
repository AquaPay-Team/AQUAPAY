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

export const SHARED_USER_OPERATIONS = [
  {
    id: "user-fund",
    label: "Fund",
    icon: "Wallet",
    children: [
      {
        id: "user-fund-transfer",
        label: "Transfer/Return",
        path: "/user/fund/transfer-return",
        icon: "Send",
      },
      {
        id: "user-fund-report",
        label: "Transfer Return Report",
        path: "/user/fund/transfer-return-report",
        icon: "FileText",
      },
    ],
  },
  {
    id: "user-services",
    label: "Services",
    icon: "Zap",
    children: [
      {
        id: "user-services-add-money",
        label: "Add Money",
        path: "/user/services/add-money",
        icon: "Zap",
      },
      {
        id: "user-services-cc-bill",
        label: "Credit Card Bill 2",
        path: "/user/services/credit-card-bill",
        icon: "CreditCard",
      },
      {
        id: "user-services-payout",
        label: "Payout",
        path: "/user/services/payout",
        icon: "Send",
      },
      {
        id: "user-services-rupay-upi",
        label: "RupayUpi",
        path: "/user/services/rupay-upi",
        icon: "QrCode",
      },
    ],
  },
  {
    id: "user-reports",
    label: "Transaction Report",
    icon: "FileText",
    children: [
      {
        id: "user-reports-all",
        label: "All Transaction Report",
        path: "/user/dashboard",
        icon: "FileText",
      },
      {
        id: "user-reports-payout",
        label: "Payout Report",
        path: "/user/reports/payout",
        icon: "FileText",
      },
      {
        id: "user-reports-cc-offline",
        label: "Creditcard Offline Report",
        path: "/user/reports/creditcard-offline",
        icon: "FileText",
      },
      {
        id: "user-reports-cc-payment",
        label: "Creditcard Payment Report",
        path: "/user/reports/creditcard-payment",
        icon: "FileText",
      },
      {
        id: "user-reports-pg",
        label: "Payment Gateway Report",
        path: "/user/reports/pg",
        icon: "FileText",
      },
      {
        id: "user-reports-pos",
        label: "POS Report",
        path: "/user/reports/pos",
        icon: "FileText",
      },
      {
        id: "user-reports-pos-request",
        label: "POS Request Report",
        path: "/user/reports/pos-request",
        icon: "FileText",
      },
    ],
  },
  {
    id: "user-statement",
    label: "Account Statement",
    path: "/user/statement",
    icon: "Landmark",
  },
];

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
  SA: [
    { id: "sa-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "sa-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "sa-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // NSM Navigation (Level 2)
  NSM: [
    { id: "nsm-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "nsm-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "nsm-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // State Head Navigation (Level 3)
  SH: [
    { id: "sh-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "sh-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "sh-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // CNF / CHF Navigation (Level 4)
  CNF: [
    { id: "cnf-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "cnf-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "cnf-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // Master Distributor Navigation (Level 5)
  MD: [
    { id: "md-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "md-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "md-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // Distributor Navigation (Level 6)
  DT: [
    { id: "dt-dashboard", label: "Dashboard", path: "/user/dashboard", icon: "LayoutDashboard" },
    { id: "dt-roles", isDynamicRoles: true },
    ...SHARED_USER_OPERATIONS,
    { id: "dt-settings", label: "Settings", path: "/user/settings", icon: "Settings" },
  ],

  // Retailer Navigation (Level 7) - Dedicated Merchant Terminal (No Roles section since retailer has no children)
  RT: [
    {
      id: "rt-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    ...SHARED_USER_OPERATIONS,
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
      userOrRole.role_slug || userOrRole.slug || userOrRole.role_name || userOrRole.role || ""
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

  if (slug === "AD") {
    return ROLE_NAVIGATION.AD;
  }

  const isRetailer =
    slug === "RT" ||
    Number(userOrRole?.role_id) === 8 ||
    String(userOrRole?.role_slug || "").toUpperCase() === "RT" ||
    String(userOrRole?.role_name || "").toUpperCase() === "RETAILER" ||
    String(userOrRole?.role || "").toUpperCase() === "RETAILER";
  const prefix = slug.toLowerCase();

  return [
    {
      id: `${prefix}-dashboard`,
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    // Non-retailer users have children, so they include the dynamic Roles directory.
    // Retailers do not have any child users, so Roles is omitted.
    ...(!isRetailer ? [{ id: `${prefix}-roles`, isDynamicRoles: true }] : []),
    ...SHARED_USER_OPERATIONS,
    {
      id: `${prefix}-settings`,
      label: "Settings",
      path: "/user/settings",
      icon: "Settings",
    },
  ];
}

export default ROLE_NAVIGATION;
