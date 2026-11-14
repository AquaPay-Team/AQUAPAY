/**
 * AquaPay Role Definitions & Hierarchy Constants
 * Directly aligned with backend: database/seeds/001_roles.sql and src/constants/roles.js
 *
 * Role Hierarchy:
 * Level 0: Admin (ID 1, AD) -> Exclusively for Admin Portal
 * Level 1: Sub Admin (ID 2, SA) -> Normal User Portal
 * Level 2: NSM (ID 3, NSM) -> Normal User Portal
 * Level 3: State Head (ID 4, SH) -> Normal User Portal
 * Level 4: CNF / CHF (ID 5, CNF) -> Normal User Portal
 * Level 5: Master Distributor (ID 6, MD) -> Normal User Portal
 * Level 6: Distributor (ID 7, DT) -> Normal User Portal
 * Level 7: Retailer (ID 8, RT) -> Normal User Portal
 */

export const ROLES = [
  { id: 1, slug: "AD", name: "Admin", level: 0, isAdmin: true },
  { id: 2, slug: "SA", name: "Sub Admin", level: 1, isAdmin: false },
  {
    id: 3,
    slug: "NSM",
    name: "NSM",
    level: 2,
    aliases: ["NSM / NSH", "NSH", "National State Manager"],
    isAdmin: false,
  },
  {
    id: 4,
    slug: "SH",
    name: "State Head",
    level: 3,
    aliases: ["SH"],
    isAdmin: false,
  },
  {
    id: 5,
    slug: "CNF",
    name: "CNF / CHF",
    level: 4,
    aliases: ["CNF", "CHF", "C&F"],
    isAdmin: false,
  },
  {
    id: 6,
    slug: "MD",
    name: "Master Distributor",
    level: 5,
    aliases: ["MD"],
    isAdmin: false,
  },
  {
    id: 7,
    slug: "DT",
    name: "Distributor",
    level: 6,
    aliases: ["DT"],
    isAdmin: false,
  },
  {
    id: 8,
    slug: "RT",
    name: "Retailer",
    level: 7,
    aliases: ["RT"],
    isAdmin: false,
  },
];

export const NORMAL_USER_ROLES = ROLES.filter((r) => !r.isAdmin);

/**
 * Returns true exclusively for Admin (Role 1 / AD)
 */
export function isAdminRole(roleOrUser) {
  if (!roleOrUser) return false;

  if (typeof roleOrUser === "object") {
    const roleId = Number(roleOrUser.role_id || roleOrUser.id);
    if (roleId === 1) return true;
    const slug = String(
      roleOrUser.role_slug || roleOrUser.slug || ""
    ).trim().toUpperCase();
    const name = String(
      roleOrUser.role_name || roleOrUser.name || ""
    ).trim().toUpperCase();
    return (
      slug === "AD" ||
      name === "ADMIN" ||
      name === "SUPER ADMIN" ||
      name === "SUPERADMIN"
    );
  }

  if (typeof roleOrUser === "number") {
    return roleOrUser === 1;
  }

  const str = String(roleOrUser).trim().toUpperCase();
  return (
    str === "1" ||
    str === "AD" ||
    str === "ADMIN" ||
    str === "SUPER ADMIN" ||
    str === "SUPERADMIN"
  );
}

/**
 * Returns true for all authorized non-admin roles:
 * Sub Admin, NSM, State Head, CNF/CHF, Master Distributor, Distributor, Retailer (Roles 2 through 8)
 */
export function isNormalUserRole(roleOrUser) {
  if (!roleOrUser) return false;
  if (isAdminRole(roleOrUser)) return false;

  if (typeof roleOrUser === "object") {
    const roleId = Number(roleOrUser.role_id || roleOrUser.id);
    if (roleId >= 2 && roleId <= 8) return true;

    const slug = String(
      roleOrUser.role_slug || roleOrUser.slug || ""
    ).trim().toUpperCase();
    const name = String(
      roleOrUser.role_name || roleOrUser.name || ""
    ).trim().toUpperCase();

    return NORMAL_USER_ROLES.some(
      (r) =>
        r.slug === slug ||
        r.name.toUpperCase() === name ||
        (r.aliases &&
          r.aliases.some(
            (a) => a.toUpperCase() === name || a.toUpperCase() === slug
          ))
    );
  }

  if (typeof roleOrUser === "number") {
    return roleOrUser >= 2 && roleOrUser <= 8;
  }

  const idNum = Number(roleOrUser);
  if (!isNaN(idNum) && idNum >= 2 && idNum <= 8) return true;

  const str = String(roleOrUser).trim().toUpperCase();
  return NORMAL_USER_ROLES.some(
    (r) =>
      r.slug === str ||
      r.name.toUpperCase() === str ||
      (r.aliases && r.aliases.some((a) => a.toUpperCase() === str))
  );
}

/**
 * Resolves role metadata for display and permission checks
 */
export function getRoleMeta(roleOrUser) {
  if (!roleOrUser) return null;
  const roleId =
    typeof roleOrUser === "object"
      ? Number(roleOrUser.role_id || roleOrUser.id)
      : Number(roleOrUser);

  if (roleId) {
    const found = ROLES.find((r) => r.id === roleId);
    if (found) return found;
  }

  const str =
    typeof roleOrUser === "object"
      ? String(
          roleOrUser.role_slug ||
            roleOrUser.slug ||
            roleOrUser.role_name ||
            roleOrUser.name ||
            ""
        )
          .trim()
          .toUpperCase()
      : String(roleOrUser).trim().toUpperCase();

  return (
    ROLES.find(
      (r) =>
        r.slug === str ||
        r.name.toUpperCase() === str ||
        (r.aliases && r.aliases.some((a) => a.toUpperCase() === str))
    ) || null
  );
}

export default {
  ROLES,
  NORMAL_USER_ROLES,
  isAdminRole,
  isNormalUserRole,
  getRoleMeta,
};
