export const SIM_VERSION = "0.0.0";

/** Fixed simulation tick rate. Time in the sim is an integer tick counter, never wall-clock. */
export const TICKS_PER_SECOND = 10;

export type Facing = "N" | "E" | "S" | "W";

export const FACINGS: readonly Facing[] = ["N", "E", "S", "W"];

/** Clockwise 90° turn. */
export function turnRight(facing: Facing): Facing {
  const i = FACINGS.indexOf(facing);
  return FACINGS[(i + 1) % 4] as Facing;
}

/** Counter-clockwise 90° turn. */
export function turnLeft(facing: Facing): Facing {
  const i = FACINGS.indexOf(facing);
  return FACINGS[(i + 3) % 4] as Facing;
}
