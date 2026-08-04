import { TICKS_PER_SECOND } from "../constants";

export interface SpellType {
  id: string;
  name: string;
}

/**
 * Canonical sequences → spells (docs/SPELLS.md "Spell registry"). Keyed by the
 * non-potency runes joined with "+" — potency is the free scalar, never part
 * of the key. M0 ships exactly two; the near-term book (Frostbolt, Healmist,
 * Truesight…) lands M1-M2.
 */
export const SPELL_REGISTRY: Readonly<Record<string, SpellType>> = {
  lume: { id: "light", name: "Light" },
  "ign+dart": { id: "firebolt", name: "Firebolt" },
};

/**
 * The spell a completed buffer resolves to, or undefined = fizzle (mana
 * already lost). Potency is stripped first (the "free scalar" — SPELLS.md
 * "Spell registry"), then matched by longest-known prefix of the remaining
 * essence[+form[+aspect]] runes: an aspect (or form) with no registry entry
 * of its own still resolves to whatever essence+form spell it modifies,
 * rather than fizzling a legitimately-cast spell just because it carried a
 * targeting/duration/subtlety flourish the M0 registry hasn't special-cased.
 */
export function resolveSpell(buffer: readonly string[]): SpellType | undefined {
  const rest = buffer.slice(1);
  for (let length = rest.length; length >= 1; length--) {
    const spell = SPELL_REGISTRY[rest.slice(0, length).join("+")];
    if (spell) return spell;
  }
  return undefined;
}

// --- M0 spell effect tuning ---

/** Light: torch boost duration = 30s × potency multiplier (SPELLS.md). */
export const LIGHT_DURATION_TICKS_PER_MULTIPLIER = 30 * TICKS_PER_SECOND;

/** Firebolt: 1 tile per 2 ticks (SPELLS.md). */
export const PROJECTILE_TICKS_PER_TILE = 2;

/** Firebolt damage = 5 × multiplier — recorded on the projectile now, spent on monsters in M1. */
export const FIREBOLT_DAMAGE_PER_MULTIPLIER = 5;
