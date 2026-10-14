const ROLES = [
  { slug: "AD",  name: "Admin",              level: 0 },
  { slug: "SA",  name: "Sub Admin",          level: 1 },
  { slug: "NSM", name: "NSM",                level: 2, aliases: ["NSM / NSH", "NSH", "National State Manager"] },
  { slug: "SH",  name: "SH",                 level: 3, aliases: ["State Head"] },
  { slug: "CHF", name: "CHF",                level: 4, aliases: ["CNF", "C&F"] },
  { slug: "MD",  name: "Master Distributor", level: 5 },
  { slug: "DT",  name: "Distributor",        level: 6 },
  { slug: "RT",  name: "Retailer",           level: 7 },
];

function getRole(input) {
  if (!input) return null;
  const str = String(input).trim().toLowerCase();
  return (
    ROLES.find(
      (r) =>
        r.slug.toLowerCase() === str ||
        r.name.toLowerCase() === str ||
        (r.aliases && r.aliases.some((a) => a.toLowerCase() === str))
    ) || null
  );
}

function getChildSlug(slug) {
  const role = getRole(slug);
  if (!role) return null;

  const hierarchy = {
    AD: "SA",
    SA: "NSM",
    NSM: "SH",
    SH: "CNF",
    CNF: "MD",
    MD: "DT",
    DT: "RT",
    RT: null,
  };

  return hierarchy[role.slug] ?? null;
}

function canCreateChildRole(parentInput, childInput) {
  const parent = getRole(parentInput);
  const child = getRole(childInput);
  if (!parent || !child) return false;

  // Admin can create any subordinate role
  if (parent.slug === "AD" || parent.level === 0) {
    return child.level > parent.level;
  }

  // Non-admin can only create the direct next child role in hierarchy
  return child.level === parent.level + 1;
}

function getRoleBySlug(slug) {
  return getRole(slug);
}

function getRoleByName(name) {
  return getRole(name);
}

module.exports = {
  ROLES,
  getRole,
  getChildSlug,
  canCreateChildRole,
  getRoleBySlug,
  getRoleByName,
};


