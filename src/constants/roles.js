export const ROLES = [
  { slug: "AD",  name: "Admin",              level: 0 },
  { slug: "SA",  name: "Sub Admin",          level: 1 },
  { slug: "NSM", name: "NSM / NSH",          level: 2 },
  { slug: "SH",  name: "SH",                 level: 3 },
  { slug: "CHF", name: "CHF",                level: 4 },
  { slug: "MD",  name: "Master Distributor", level: 5 },
  { slug: "DT",  name: "Distributor",        level: 6 },
  { slug: "RT",  name: "Retailer",           level: 7 },
];

export function getChildSlug(slug) {
  const i = ROLES.findIndex((r) => r.slug === slug);
  return i >= 0 && i < ROLES.length - 1 ? ROLES[i + 1].slug : null;
}

export default { ROLES, getChildSlug };
