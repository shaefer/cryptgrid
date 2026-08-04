export interface SpellMasteryEntry {
  uses: number;
  successes: number;
}

/**
 * Sparse — starts empty and is populated lazily on first cast, never
 * pre-seeded. The spell-id key space belongs to `spells/registry.ts`, which
 * doesn't exist until M0.9; pre-seeding here would mean this module
 * importing a not-yet-built one. See docs/STATS.md "Spell mastery."
 */
export type SpellMasteryMap = Record<string, SpellMasteryEntry>;

export function createInitialSpellMastery(): SpellMasteryMap {
  return {};
}

/** Called from spell-cast resolution starting M0.9; unused but ready in M0.6. */
export function recordSpellUse(
  mastery: SpellMasteryMap,
  spellId: string,
  success: boolean,
): SpellMasteryMap {
  const existing = mastery[spellId] ?? { uses: 0, successes: 0 };
  return {
    ...mastery,
    [spellId]: {
      uses: existing.uses + 1,
      successes: existing.successes + (success ? 1 : 0),
    },
  };
}
