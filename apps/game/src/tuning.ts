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
export const CAMERA_HEIGHT = 1.5;

/**
 * Constant downward tilt. With a level camera (0deg) at CAMERA_HEIGHT=1.5 and
 * FOV=75, the floor only enters frame ~1.95 world units ahead — farther than
 * the 1.5 units to a wall filling the near half of the current tile. Facing a
 * wall dead-on therefore shows 100% wall, 0% floor: no room to see items on
 * the floor near that wall.
 *
 * A downward tilt pulls that near-floor-visible distance in. At 12deg it's
 * ~1.28 units, giving a visible sliver between there and the 1.5-unit wall —
 * "the edge of the floor," not the whole tile — while keeping most of the
 * frame on the wall (important once secret switches live there in M0.8).
 * Item quadrants (M0.7) are assumed at +-0.75 from tile center; fully
 * revealing the near-wall quadrant would need significantly more tilt, which
 * reads as staring at your feet during normal corridor walking. This is a
 * first pass — revisit once real item sprites exist to check against
 * (user-tuned down from an initial 15deg/1.6 pairing during M0.4 playtesting).
 */
export const CAMERA_PITCH_DEG = 12;

/** Torch flicker: base intensity plus two out-of-phase sine terms (amplitude, rate in rad/s). */
export const TORCH_BASE_INTENSITY = 60;
export const TORCH_DISTANCE = 20;
export const TORCH_FLICKER = [
  { amplitude: 4, rate: 7.3 },
  { amplitude: 3, rate: 13.1 },
] as const;

/** Light spell (M0.9): while state.party.lightBoostUntil > tick, the torch burns brighter and farther. */
export const LIGHT_BOOST_INTENSITY_MULT = 2.2;
export const LIGHT_BOOST_DISTANCE = 34;

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
