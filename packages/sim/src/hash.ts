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
