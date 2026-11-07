function normalizeFullName(value) {
  if (typeof value !== "string") return [];
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\p{P}/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized ? normalized.split(" ") : [];
}

function compareFullNames(firstName, secondName) {
  const firstTokens = normalizeFullName(firstName);
  const secondTokens = normalizeFullName(secondName);
  if (firstTokens.length === 0 || secondTokens.length === 0 || firstTokens.length !== secondTokens.length) {
    return false;
  }
  firstTokens.sort();
  secondTokens.sort();
  return firstTokens.every((token, index) => token === secondTokens[index]);
}

export { compareFullNames, normalizeFullName };
export default { compareFullNames, normalizeFullName };
