/**
 * Centralized Role-Based Navigation Configuration
 * Maps directly to backend role hierarchy:
 * 1: AD (Admin)
 * 2: SA (Sub Admin)
 * 3: NSM (National Sales Manager)
 * 4: SH (State Head)
 * 5: CNF (CNF / ASM / CHF)
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
          roleSlug: "all",
          tab: "all-users",
          path: "/admin/users",
          icon: "Users",
        },
        {
          id: "admin-role-sa",
          label: "Sub Admin",
          roleSlug: "sa",
          tab: "sub-admin",
          path: "/admin/users?role=sa",
          icon: "ShieldAlert",
        },
        {
          id: "admin-role-nsm",
          label: "National Sales Manager",
          roleSlug: "nsm",
          tab: "nsm",
          path: "/admin/users?role=nsm",
          icon: "Award",
        },
        {
          id: "admin-role-sh",
          label: "State Head",
          roleSlug: "sh",
          tab: "sh",
          path: "/admin/users?role=sh",
          icon: "MapPin",
        },
        {
          id: "admin-role-cnf",
          label: "CNF / ASM",
          roleSlug: "cnf",
          tab: "cnf-asm",
          path: "/admin/users?role=cnf",
          icon: "Building",
        },
        {
          id: "admin-role-md",
          label: "Master Distributor",
          roleSlug: "md",
          tab: "master-distributor",
          path: "/admin/users?role=md",
          icon: "Layers",
        },
        {
          id: "admin-role-dt",
          label: "Distributor",
          roleSlug: "dt",
          tab: "distributor",
          path: "/admin/users?role=dt",
          icon: "Briefcase",
        },
        {
          id: "admin-role-rt",
          label: "Retailer",
          roleSlug: "rt",
          tab: "retailer",
          path: "/admin/users?role=rt",
          icon: "ShoppingBag",
        },
        {
          id: "admin-create-user",
          label: "Create User",
          tab: "create-user",
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

  // Sub Admin Navigation (Level 2) - sees NSM, SH, CNF, MD, DT, RT
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
          label: "All Downline Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "sa-role-nsm",
          label: "National Sales Manager",
          path: "/user/team?role=nsm",
          icon: "Award",
        },
        {
          id: "sa-role-sh",
          label: "State Head",
          path: "/user/team?role=sh",
          icon: "MapPin",
        },
        {
          id: "sa-role-cnf",
          label: "CNF / ASM",
          path: "/user/team?role=cnf",
          icon: "Building",
        },
        {
          id: "sa-role-md",
          label: "Master Distributor",
          path: "/user/team?role=md",
          icon: "Layers",
        },
        {
          id: "sa-role-dt",
          label: "Distributor",
          path: "/user/team?role=dt",
          icon: "Briefcase",
        },
        {
          id: "sa-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
        },
        {
          id: "sa-create-agent",
          label: "Onboard Agent",
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

  // NSM Navigation (Level 3) - sees SH, CNF, MD, DT, RT
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
          label: "All State Teams",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "nsm-role-sh",
          label: "State Head",
          path: "/user/team?role=sh",
          icon: "MapPin",
        },
        {
          id: "nsm-role-cnf",
          label: "CNF / ASM",
          path: "/user/team?role=cnf",
          icon: "Building",
        },
        {
          id: "nsm-role-md",
          label: "Master Distributor",
          path: "/user/team?role=md",
          icon: "Layers",
        },
        {
          id: "nsm-role-dt",
          label: "Distributor",
          path: "/user/team?role=dt",
          icon: "Briefcase",
        },
        {
          id: "nsm-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
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

  // State Head Navigation (Level 4) - only sees CNF, MD, DT, RT
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
          label: "All State Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "sh-role-cnf",
          label: "CNF / ASM",
          path: "/user/team?role=cnf",
          icon: "Building",
        },
        {
          id: "sh-role-md",
          label: "Master Distributor",
          path: "/user/team?role=md",
          icon: "Layers",
        },
        {
          id: "sh-role-dt",
          label: "Distributor",
          path: "/user/team?role=dt",
          icon: "Briefcase",
        },
        {
          id: "sh-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
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

  // CNF / ASM Navigation (Level 5) - only sees MD, DT, RT
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
          label: "All Territory Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "cnf-role-md",
          label: "Master Distributor",
          path: "/user/team?role=md",
          icon: "Layers",
        },
        {
          id: "cnf-role-dt",
          label: "Distributor",
          path: "/user/team?role=dt",
          icon: "Briefcase",
        },
        {
          id: "cnf-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
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

  // Master Distributor Navigation (Level 6) - only sees DT, RT
  MD: [
    {
      id: "md-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "md-team",
      label: "Distribution Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "md-all-agents",
          label: "All Downline Agents",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "md-role-dt",
          label: "Distributor",
          path: "/user/team?role=dt",
          icon: "Briefcase",
        },
        {
          id: "md-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
        },
        {
          id: "md-create-agent",
          label: "Onboard Agent",
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

  // Distributor Navigation (Level 7) - only sees Retailers (RT)
  DT: [
    {
      id: "dt-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
    {
      id: "dt-team",
      label: "Retail Network",
      path: "/user/team",
      icon: "Users",
      children: [
        {
          id: "dt-all-retailers",
          label: "All Retailers",
          path: "/user/team",
          icon: "Users",
        },
        {
          id: "dt-role-rt",
          label: "Retailer",
          path: "/user/team?role=rt",
          icon: "ShoppingBag",
        },
        {
          id: "dt-create-retailer",
          label: "Onboard Retailer",
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

  // Retailer Navigation (Level 8) - Dedicated Merchant Terminal
  RT: [
    {
      id: "rt-dashboard",
      label: "Dashboard",
      path: "/user/dashboard",
      icon: "LayoutDashboard",
    },
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
      id: "rt-kyc",
      label: "My KYC Verification",
      path: "/user/kyc",
      icon: "ShieldCheck",
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

  // Handle aliases
  if (slug === "ADMIN" || slug === "SUPER ADMIN") slug = "AD";
  if (slug === "SUB ADMIN") slug = "SA";
  if (slug === "NATIONAL SALES MANAGER") slug = "NSM";
  if (slug === "STATE HEAD") slug = "SH";
  if (slug === "CHF" || slug === "ASM") slug = "CNF";
  if (slug === "MASTER DISTRIBUTOR") slug = "MD";
  if (slug === "DISTRIBUTOR") slug = "DT";
  if (slug === "RETAILER") slug = "RT";

  return ROLE_NAVIGATION[slug] || ROLE_NAVIGATION.RT;
}

export default ROLE_NAVIGATION;
