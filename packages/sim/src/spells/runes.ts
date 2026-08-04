/**
 * The Rune Tongue (docs/SPELLS.md). A spell is POTENCY + ESSENCE [+ FORM]
 * [+ ASPECT], spoken in that order. All names/glyphs are original to
 * Cryptgrid — never Dungeon Master's or Grimrock's.
 */

export type RuneTier = "potency" | "essence" | "form" | "aspect";

export interface Rune {
  id: string;
  name: string;
  tier: RuneTier;
  /** 0-5 within its tier, ascending (drives potency multiplier + HUD ordering). */
  index: number;
}

function tierOf(tier: RuneTier, names: string[]): Rune[] {
  return names.map((name, index) => ({ id: name.toLowerCase(), name, tier, index }));
}

export const RUNES: readonly Rune[] = [
  ...tierOf("potency", ["Eth", "Kor", "Vas", "Dur", "Mal", "Zeth"]),
  ...tierOf("essence", ["Lume", "Ign", "Krys", "Vol", "Vit", "Umbra"]),
  ...tierOf("form", ["Dart", "Orbis", "Vela", "Sig", "Nim", "Korpa"]),
  ...tierOf("aspect", ["Sel", "Omn", "Fara", "Lent", "Sub", "Vera"]),
];

export const RUNES_BY_ID: Readonly<Record<string, Rune>> = Object.fromEntries(
  RUNES.map((rune) => [rune.id, rune]),
);

export function runesOfTier(tier: RuneTier): Rune[] {
  return RUNES.filter((rune) => rune.tier === tier);
}

/** ×1/×2/×3/×5/×8/×12 by potency rune index (SPELLS.md "Costs & scaling"). */
export const POTENCY_MULTIPLIERS = [1, 2, 3, 5, 8, 12] as const;

/** Base mana cost per tier, multiplied by the spell's potency multiplier — including the potency rune's own cost. */
export const RUNE_BASE_COST: Record<RuneTier, number> = {
  potency: 1,
  essence: 2,
  form: 2,
  aspect: 3,
};

export function potencyMultiplier(potencyRuneId: string): number {
  const rune = RUNES_BY_ID[potencyRuneId];
  if (!rune || rune.tier !== "potency") return 1;
  return POTENCY_MULTIPLIERS[rune.index] ?? 1;
}

/**
 * Mana cost of pressing `runeId` into a buffer whose first rune is
 * `potencyRuneId` (for the potency rune itself, that's its own id) —
 * e.g. Kor Ign Dart = (1+2+2)×2 = 10 mana.
 */
export function runeCost(runeId: string, potencyRuneId: string): number {
  const rune = RUNES_BY_ID[runeId];
  if (!rune) return 0;
  return RUNE_BASE_COST[rune.tier] * potencyMultiplier(potencyRuneId);
}

/**
 * Which tiers may legally occupy the next buffer slot — the grammar's
 * order rule. Form is optional, so slot 2 accepts form *or* aspect;
 * slot 3 only accepts aspect and only after a form.
 */
export function allowedTiersAt(buffer: readonly string[]): RuneTier[] {
  switch (buffer.length) {
    case 0:
      return ["potency"];
    case 1:
      return ["essence"];
    case 2:
      return ["form", "aspect"];
    case 3:
      return RUNES_BY_ID[buffer[2] ?? ""]?.tier === "form" ? ["aspect"] : [];
    default:
      return [];
  }
}
