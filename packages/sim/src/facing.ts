export type Facing = "N" | "E" | "S" | "W";

export const FACINGS: readonly Facing[] = ["N", "E", "S", "W"];

export const FACING_DELTA: Record<Facing, { dx: number; dz: number }> = {
  N: { dx: 0, dz: -1 },
  E: { dx: 1, dz: 0 },
  S: { dx: 0, dz: 1 },
  W: { dx: -1, dz: 0 },
};

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

export function opposite(facing: Facing): Facing {
  return turnRight(turnRight(facing));
}
