import type { CellChar, LevelDoor, LevelRuntime } from "./types";

export function cellCharAt(level: LevelRuntime, x: number, z: number): CellChar | undefined {
  if (x < 0 || z < 0 || x >= level.width || z >= level.height) return undefined;
  const row = level.cells[z];
  return row?.[x] as CellChar | undefined;
}

export function findDoorAt(level: LevelRuntime, x: number, z: number): LevelDoor | undefined {
  return level.doors.find((d) => d.x === x && d.z === z);
}

export function isWalkable(level: LevelRuntime, x: number, z: number): boolean {
  const ch = cellCharAt(level, x, z);
  if (ch === ".") return true;
  if (ch === "D" || ch === "S") return findDoorAt(level, x, z)?.open ?? false;
  return false;
}
