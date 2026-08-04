export type ElementType = "fire" | "ice" | "poison" | "lightning";

export const ELEMENT_TYPES: readonly ElementType[] = ["fire", "ice", "poison", "lightning"];

/** 0 = no resistance (baseline). Hidden by HUD policy — see docs/STATS.md "Secrecy." */
export type ResistanceMap = Record<ElementType, number>;

export function createInitialResistances(): ResistanceMap {
  const resistances = {} as ResistanceMap;
  for (const element of ELEMENT_TYPES) {
    resistances[element] = 0;
  }
  return resistances;
}
