export type WeaponType = "mace" | "axe" | "sword" | "spear" | "bow" | "thrown" | "shield";

export const WEAPON_TYPES: readonly WeaponType[] = [
  "mace",
  "axe",
  "sword",
  "spear",
  "bow",
  "thrown",
  "shield",
];

/** No `revealed` field — unlike classes, weapon skills are hidden by HUD policy alone (docs/STATS.md "Secrecy"). */
export interface WeaponSkillProgress {
  level: number;
  exp: number;
}

export type WeaponSkillMap = Record<WeaponType, WeaponSkillProgress>;

export function createInitialWeaponSkills(): WeaponSkillMap {
  const skills = {} as WeaponSkillMap;
  for (const type of WEAPON_TYPES) {
    skills[type] = { level: 0, exp: 0 };
  }
  return skills;
}
