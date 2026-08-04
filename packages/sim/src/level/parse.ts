import type { LevelJSON, LevelRuntime } from "./types";

/** Assumes json has already passed validateLevel. Never mutates the input. */
export function parseLevel(json: LevelJSON): LevelRuntime {
  return {
    id: json.id,
    name: json.name,
    width: json.width,
    height: json.height,
    cells: [...json.cells],
    start: { ...json.start },
    doors: json.doors.map((d) => ({ ...d })),
    wallFeatures: json.wallFeatures.map((f) => ({ ...f })),
    items: json.items.map((i) => ({ ...i })),
    wallOverrides: (json.wallOverrides ?? []).map((o) => ({ ...o })),
  };
}
