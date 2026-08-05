/**
 * Stable integer hash of a grid cell — deterministic, input-only, no state.
 * The renderer uses it to pick a wall-texture variant per wall *cell* (not per
 * face), so all faces of one physical stone block agree and the same level
 * always renders identically (docs/ROADMAP.md M0.8). Cosmetic today, but kept
 * in the sim package so it's Vitest-covered and available to a future server
 * if variant choice ever becomes gameplay-relevant.
 */
export function cellHash(x: number, z: number): number {
  // Two large primes (classic spatial-hash constants), xor-folded. >>> 0
  // keeps the result an unsigned 32-bit int so modulo behaves for callers.
  return (Math.imul(x, 73856093) ^ Math.imul(z, 19349663)) >>> 0;
}

/** Picks one of `count` wall variants for the wall cell at (x, z). */
export function wallVariantIndex(x: number, z: number, count: number): number {
  return count > 0 ? cellHash(x, z) % count : 0;
}

/**
 * The 3 wall looks (ASSETS.md) the automatic per-cell hash picks among.
 * Order is load-bearing, matches DungeonTextures.wallVariants.
 */
export const BASE_WALL_VARIANT_IDS = ["stone", "fieldstone", "thinbrick"] as const;
export type BaseWallVariantId = (typeof BASE_WALL_VARIANT_IDS)[number];

/**
 * Single-wall-width blends between two base looks (docs/ROADMAP.md M0.11) —
 * editor-authored only (a wallOverrides entry), never picked by the automatic
 * hash. No secret-tell variant exists for these — see features.ts.
 */
export const TRANSITION_WALL_VARIANT_IDS = [
  "stone-fieldstone",
  "stone-thinbrick",
  "fieldstone-thinbrick",
] as const;
export type TransitionWallVariantId = (typeof TRANSITION_WALL_VARIANT_IDS)[number];

/** Every renderable wall look — what an author can place via wallOverrides. */
export const WALL_VARIANT_IDS = [...BASE_WALL_VARIANT_IDS, ...TRANSITION_WALL_VARIANT_IDS] as const;
export type WallVariantId = (typeof WALL_VARIANT_IDS)[number];

/**
 * The variant a wall cell gets with no authored override — deterministic,
 * zero authoring burden. Only ever picks among the 3 base looks; transitions
 * are editor-authored, the hash stays unaware they exist (docs/ROADMAP.md M0.11).
 */
export function autoWallVariant(x: number, z: number): BaseWallVariantId {
  return BASE_WALL_VARIANT_IDS[wallVariantIndex(x, z, BASE_WALL_VARIANT_IDS.length)]!;
}

/** Deterministic string hash — used to pick a secret-tell variant from a switch's own id (features.ts). */
export function stringHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}
