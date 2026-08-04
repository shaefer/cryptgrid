export type RngState = number;

export interface Rng {
  next(): number;
  getState(): RngState;
}

/**
 * mulberry32 — small, fast, seedable PRNG. All sim randomness must go through
 * this (never Math.random) so replays and multiplayer stay deterministic.
 */
export function createRng(seed: RngState): Rng {
  let state = seed >>> 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    getState(): RngState {
      return state >>> 0;
    },
  };
}
