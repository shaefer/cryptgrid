import { autoWallVariant, stringHash, type WallVariantId } from "../hash";
import type {
  AlcoveFeature,
  CellChar,
  ItemSlot,
  LevelDoor,
  LevelItem,
  LevelRuntime,
  WallFeature,
} from "./types";

const QUADRANT_SLOTS = ["ne", "se", "nw", "sw"] as const satisfies readonly ItemSlot[];

/**
 * A slot-less item picks a quadrant deterministically from its own id
 * (mirrors the wall-variant/secret-tell hash pattern elsewhere) — same item
 * always renders/reaches the same way, and un-slotted items scatter across
 * quadrants instead of all landing in one spot.
 */
export function resolveItemSlot(item: Pick<LevelItem, "id" | "slot">): ItemSlot {
  return item.slot ?? QUADRANT_SLOTS[stringHash(item.id) % QUADRANT_SLOTS.length]!;
}

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
  return level.items.find((item) => item.x === x && item.z === z && resolveItemSlot(item) === slot);
}

export function findItemById(level: LevelRuntime, id: string): LevelItem | undefined {
  return level.items.find((item) => item.id === id);
}

export function findDoorById(level: LevelRuntime, id: string): LevelDoor | undefined {
  return level.doors.find((door) => door.id === id);
}

export function findFeatureById(level: LevelRuntime, id: string): WallFeature | undefined {
  return level.wallFeatures.find((feature) => feature.id === id);
}

/** The wall look at (x, z) — an authored override if one exists there, else the deterministic auto-pick. */
export function resolveWallVariant(level: LevelRuntime, x: number, z: number): WallVariantId {
  const override = level.wallOverrides.find((o) => o.x === x && o.z === z);
  return override ? override.variant : autoWallVariant(x, z);
}

/** Every alcove reachable from the floor cell (x, z) — hidden ones excluded unless includeHidden. */
export function alcovesAt(
  level: LevelRuntime,
  x: number,
  z: number,
  includeHidden = false,
): AlcoveFeature[] {
  return level.wallFeatures.filter(
    (feature): feature is AlcoveFeature =>
      feature.type === "alcove" &&
      feature.x === x &&
      feature.z === z &&
      (includeHidden || !feature.hidden),
  );
}
