import type { ClassId } from "./classes";

/** Placeholder ids — the exact tier set is M2 content work (docs/STATS.md "Armor tiers"). */
export type ArmorTierId = "cloth" | "leather" | "chain" | "plate";

/**
 * Which class-level combination *qualifies* a character for a tier —
 * qualification only, never "currently worn" (that's M2's paper-doll equip
 * system). All listed class minimums are required (AND), not any-of.
 */
export interface ArmorTierRule {
  tier: ArmorTierId;
  requires: Partial<Record<ClassId, number>>;
}

/** Empty until M2 defines real tables — the shape exists now so M2 doesn't need a data-model change. */
export const ARMOR_TIER_RULES: readonly ArmorTierRule[] = [];
