/**
 * Movement feel — every constant worth arguing about, in one place.
 *
 * "Movement feel is the soul of the genre" (ROADMAP M0.4), so these are meant
 * to be edited live with the dev server running. Nothing here changes game
 * rules; the sim's own cadence is ACTION_COOLDOWN_TICKS in packages/sim.
 */

/** Tile step tween. Matches the sim's 2-tick cooldown (200ms at 10Hz) so held-key movement is continuous. */
export const MOVE_TWEEN_MS = 200;

/**
 * 90° turn tween. Deliberately shorter than the 200ms cooldown — the extra
 * ~50ms is a settle beat that keeps held-key turning from feeling like a spin.
 */
export const TURN_TWEEN_MS = 150;

/** Wall bump: how far the camera lurches toward the wall, in world units (tile = 3). */
export const BUMP_DISTANCE = 0.16;

/** Wall bump: full out-and-back duration. Kept under the cooldown so it resolves before the next action. */
export const BUMP_MS = 180;

/** Eye height in a 3-unit-tall corridor. */
export const CAMERA_HEIGHT = 1.6;

/** Torch flicker: base intensity plus two out-of-phase sine terms (amplitude, rate in rad/s). */
export const TORCH_BASE_INTENSITY = 60;
export const TORCH_FLICKER = [
  { amplitude: 4, rate: 7.3 },
  { amplitude: 3, rate: 13.1 },
] as const;

/**
 * Easing for move and turn tweens. Quadratic ease-out is the "slight ease-out"
 * of GAME_DESIGN.md — strong enough to land softly, gentle enough that chained
 * steps don't read as a pulsing stutter. Swap to easeOutCubic for more settle.
 */
export function ease(t: number): number {
  return easeOutQuad(t);
}

export function easeOutQuad(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

export function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

export function easeLinear(t: number): number {
  return t;
}
