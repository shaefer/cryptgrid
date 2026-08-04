import type { CellChar, ItemSlot, LevelDoor, LevelItem, LevelRuntime } from "./types";

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

export function findItemAt(
  level: LevelRuntime,
  x: number,
  z: number,
  slot: ItemSlot,
): LevelItem | undefined {
  return level.items.find((item) => item.x === x && item.z === z && (item.slot ?? "center") === slot);
}

export function findItemById(level: LevelRuntime, id: string): LevelItem | undefined {
  return level.items.find((item) => item.id === id);
}
