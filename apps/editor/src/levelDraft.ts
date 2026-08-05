import type {
  AlcoveItem,
  CellChar,
  DoorType,
  Facing,
  ItemSlot,
  LevelDoor,
  LevelItem,
  LevelJSON,
  SwitchAction,
  WallFeature,
  WallOverride,
  WallVariantId,
} from "@cryptgrid/sim";

/** A fresh, valid, all-void level to start a new design from. */
export function createBlankLevel(width: number, height: number): LevelJSON {
  const cells = Array.from({ length: height }, (_, z) =>
    Array.from({ length: width }, (_, x) => (x === 0 || z === 0 || x === width - 1 || z === height - 1 ? "X" : "."))
      .join(""),
  );
  return {
    formatVersion: 1,
    id: "untitled",
    name: "Untitled Level",
    width,
    height,
    cells,
    start: { x: 1, z: 1, facing: "S" },
    doors: [],
    wallFeatures: [],
    items: [],
    wallOverrides: [],
    triggers: [],
    spawns: [],
  };
}

export function cellAt(level: LevelJSON, x: number, z: number): CellChar | undefined {
  return level.cells[z]?.[x] as CellChar | undefined;
}

function setCellChar(level: LevelJSON, x: number, z: number, ch: CellChar): LevelJSON {
  const row = level.cells[z];
  if (row === undefined) return level;
  const nextRow = row.slice(0, x) + ch + row.slice(x + 1);
  const cells = level.cells.slice();
  cells[z] = nextRow;
  return { ...level, cells };
}

function nextAutoId(existing: readonly { id: string }[], prefix: string): string {
  let n = 1;
  const ids = new Set(existing.map((e) => e.id));
  while (ids.has(`${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

/**
 * Paints a terrain cell, keeping doors[] in sync: painting Door/Secret Door
 * creates an entry (auto id, sensible defaults) if none exists there yet;
 * painting anything else over a door cell removes its entry. Painting a
 * door type onto a cell that's *already* that same door type is a no-op —
 * callers should route that click to selection instead (App.tsx does).
 */
export function paintTerrain(level: LevelJSON, x: number, z: number, ch: CellChar): LevelJSON {
  const before = cellAt(level, x, z);
  if (before === ch) return level;

  let next = setCellChar(level, x, z, ch);

  if (before === "D" || before === "S") {
    next = { ...next, doors: next.doors.filter((d) => !(d.x === x && d.z === z)) };
  }
  if (ch === "D" || ch === "S") {
    const type: DoorType = ch === "D" ? "portcullis" : "secret";
    const door: LevelDoor = { id: nextAutoId(level.doors, "door_"), x, z, type, open: false };
    next = { ...next, doors: [...next.doors, door] };
  }

  // Anything that isn't floor can't host items or wall-mounted features rooted here.
  if (ch !== ".") {
    next = { ...next, items: next.items.filter((i) => !(i.x === x && i.z === z)) };
  }

  return next;
}

export function updateDoor(level: LevelJSON, doorId: string, patch: Partial<LevelDoor>): LevelJSON {
  return { ...level, doors: level.doors.map((d) => (d.id === doorId ? { ...d, ...patch } : d)) };
}

export function setStart(level: LevelJSON, x: number, z: number): LevelJSON {
  return { ...level, start: { ...level.start, x, z } };
}

export function setStartFacing(level: LevelJSON, facing: Facing): LevelJSON {
  return { ...level, start: { ...level.start, facing } };
}

// --- Items ---

export function placeItem(
  level: LevelJSON,
  x: number,
  z: number,
  slot: ItemSlot,
  type: string,
): LevelJSON {
  const id = nextAutoId(level.items, "itm_");
  const item: LevelItem = slot === "center" ? { id, type, x, z } : { id, type, x, z, slot };
  return { ...level, items: [...level.items, item] };
}

export function removeItem(level: LevelJSON, itemId: string): LevelJSON {
  return { ...level, items: level.items.filter((i) => i.id !== itemId) };
}

export function updateItem(level: LevelJSON, itemId: string, patch: Partial<LevelItem>): LevelJSON {
  return { ...level, items: level.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) };
}

// --- Wall features ---

export function placeFeature(
  level: LevelJSON,
  x: number,
  z: number,
  face: Facing,
  type: WallFeature["type"],
): LevelJSON {
  const id = nextAutoId(level.wallFeatures, `${type}_`);
  const base = { id, x, z, face };
  const feature: WallFeature =
    type === "switch"
      ? { ...base, type, targets: [], action: "toggle" }
      : type === "lever"
        ? { ...base, type, targets: [], action: "toggle" }
        : type === "alcove"
          ? { ...base, type, items: [] }
          : { ...base, type, text: "" };
  return { ...level, wallFeatures: [...level.wallFeatures, feature] };
}

export function removeFeature(level: LevelJSON, featureId: string): LevelJSON {
  return { ...level, wallFeatures: level.wallFeatures.filter((f) => f.id !== featureId) };
}

export function updateFeature(
  level: LevelJSON,
  featureId: string,
  patch: Partial<WallFeature>,
): LevelJSON {
  return {
    ...level,
    wallFeatures: level.wallFeatures.map((f) =>
      f.id === featureId ? ({ ...f, ...patch } as WallFeature) : f,
    ),
  };
}

export function toggleSwitchTarget(level: LevelJSON, featureId: string, targetId: string): LevelJSON {
  return {
    ...level,
    wallFeatures: level.wallFeatures.map((f) => {
      if (f.id !== featureId || (f.type !== "switch" && f.type !== "lever")) return f;
      const targets = f.targets.includes(targetId)
        ? f.targets.filter((t) => t !== targetId)
        : [...f.targets, targetId];
      return { ...f, targets };
    }),
  };
}

export function setSwitchAction(level: LevelJSON, featureId: string, action: SwitchAction): LevelJSON {
  return updateFeature(level, featureId, { action } as Partial<WallFeature>);
}

/** Toggles a switch's secretBrick variant — dropping the key entirely when off, never `variant: undefined`. */
export function setSwitchSecret(level: LevelJSON, featureId: string, secret: boolean): LevelJSON {
  return {
    ...level,
    wallFeatures: level.wallFeatures.map((f) => {
      if (f.id !== featureId || f.type !== "switch") return f;
      if (secret) return { ...f, variant: "secretBrick" };
      // Omit `variant` explicitly rather than setting it undefined — exactOptionalPropertyTypes
      // treats { variant: undefined } as a type error, and the field should be absent, not null-ish.
      return { id: f.id, x: f.x, z: f.z, face: f.face, type: f.type, targets: f.targets, action: f.action };
    }),
  };
}

export function addAlcoveItem(level: LevelJSON, alcoveId: string, type: string): LevelJSON {
  return {
    ...level,
    wallFeatures: level.wallFeatures.map((f) => {
      if (f.id !== alcoveId || f.type !== "alcove") return f;
      const item: AlcoveItem = { id: nextAutoId(f.items, "itm_"), type };
      return { ...f, items: [...f.items, item] };
    }),
  };
}

export function removeAlcoveItem(level: LevelJSON, alcoveId: string, itemId: string): LevelJSON {
  return {
    ...level,
    wallFeatures: level.wallFeatures.map((f) =>
      f.id === alcoveId && f.type === "alcove" ? { ...f, items: f.items.filter((i) => i.id !== itemId) } : f,
    ),
  };
}

// --- Wall texture overrides ---

/** Sets (or, with variant=null, clears back to Auto) a wall cell's texture override. */
export function setWallOverride(level: LevelJSON, x: number, z: number, variant: WallVariantId | null): LevelJSON {
  const withoutThis = (level.wallOverrides ?? []).filter((o) => !(o.x === x && o.z === z));
  if (variant === null) return { ...level, wallOverrides: withoutThis };
  const override: WallOverride = { x, z, variant };
  return { ...level, wallOverrides: [...withoutThis, override] };
}
