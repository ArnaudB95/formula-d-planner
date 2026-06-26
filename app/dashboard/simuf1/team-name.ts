const normalizeAscii = (value: string) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeTeamNameKey = (teamName: string) =>
  normalizeAscii(teamName).replace(/[^a-z0-9]+/g, " ").trim();

export const slugifyTeamName = (teamName: string) =>
  normalizeAscii(teamName).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

const TEAM_ALIAS_BY_KEY: Record<string, string> = {
  "bears fury crew": "Bears Fury Crew",
  "bear s fury crew": "Bears Fury Crew",
  "bear fury crew": "Bears Fury Crew",
  "bearsfurycrew": "Bears Fury Crew",

  "tiger fury crew": "Tiger Fury Crew",
  "tiger s fury crew": "Tiger Fury Crew",
  "tigers fury crew": "Tiger Fury Crew",
  "tigersfurycrew": "Tiger Fury Crew",

  frx: "FRX",

  medellin: "Medellin",
};

export const canonicalTeamName = (teamName: string) => {
  const raw = String(teamName || "").trim();
  if (!raw) return "";

  const normalizedKey = normalizeTeamNameKey(raw);
  if (!normalizedKey) return raw;

  return TEAM_ALIAS_BY_KEY[normalizedKey] || raw;
};

export const isSameTeamName = (a: string, b: string) => {
  const aCanonical = canonicalTeamName(a);
  const bCanonical = canonicalTeamName(b);

  const aKey = normalizeTeamNameKey(aCanonical || a);
  const bKey = normalizeTeamNameKey(bCanonical || b);
  return !!aKey && aKey === bKey;
};

const FIXED_PILOT_NAMES_BY_TEAM: Record<string, [string, string]> = {
  medellin: ["Sebastian", "El Colombiano"],
};

export const getFixedPilotNamesByTeam = (teamName: string): [string, string] | null => {
  const key = normalizeTeamNameKey(canonicalTeamName(teamName) || teamName);
  if (!key) return null;
  return FIXED_PILOT_NAMES_BY_TEAM[key] || null;
};
