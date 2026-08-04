export type ClassId = "fighter" | "ranger" | "wizard" | "priest" | "rogue" | "bard";

export const CLASS_IDS: readonly ClassId[] = [
  "fighter",
  "ranger",
  "wizard",
  "priest",
  "rogue",
  "bard",
];

export interface ClassProgress {
  level: number;
  exp: number;
  /** Permanent, one-time reveal flag (docs/STATS.md "Secrecy") — not re-hidden once true. */
  revealed: boolean;
}

export type ClassProgressMap = Record<ClassId, ClassProgress>;

export interface ClassDefinition {
  id: ClassId;
  name: string;
  revealedByDefault: boolean;
}

/** Fighter/Ranger/Wizard/Priest are visible from character creation; Rogue/Bard reveal via a specific trigger (M1/M2). */
export const CLASS_REGISTRY: Record<ClassId, ClassDefinition> = {
  fighter: { id: "fighter", name: "Fighter", revealedByDefault: true },
  ranger: { id: "ranger", name: "Ranger", revealedByDefault: true },
  wizard: { id: "wizard", name: "Wizard", revealedByDefault: true },
  priest: { id: "priest", name: "Priest", revealedByDefault: true },
  rogue: { id: "rogue", name: "Rogue", revealedByDefault: false },
  bard: { id: "bard", name: "Bard", revealedByDefault: false },
};

export function createInitialClassProgress(): ClassProgressMap {
  const progress = {} as ClassProgressMap;
  for (const id of CLASS_IDS) {
    progress[id] = { level: 0, exp: 0, revealed: CLASS_REGISTRY[id].revealedByDefault };
  }
  return progress;
}
