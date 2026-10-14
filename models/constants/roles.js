
const ROLES = [
  { slug: "AD", name: "Admin", level: 0 },
  { slug: "SA", name: "Sub Admin", level: 1 },
  { slug: "NSM", name: "NSM / NSH", level: 2 },
  { slug: "SH", name: "SH", level: 3 },
  { slug: "CHF", name: "CHF", level: 4 },
  { slug: "MD", name: "Master Distributor", level: 5 },
  { slug: "DT", name: "Distributor", level: 6 },
  { slug: "RT", name: "Retailer", level: 7 },
];

// Returns the immediate next child role.
function getChildSlug(slug) {
  const index = ROLES.findIndex((role) => role.slug === slug);

  return index >= 0 && index < ROLES.length - 1
    ? ROLES[index + 1].slug
    : null;
}

// Returns all roles below the given role in the hierarchy.
function getChildSlugs(slug) {
  const index = ROLES.findIndex((role) => role.slug === slug);

  if (index === -1) {
    return [];
  }

  return ROLES.slice(index + 1).map((role) => role.slug);
}

module.exports = {
  ROLES,
  getChildSlug,
  getChildSlugs,
};
