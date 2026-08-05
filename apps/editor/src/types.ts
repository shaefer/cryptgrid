import type { CellChar, WallFeature, WallVariantId } from "@cryptgrid/sim";

/** LEVELS.md's editor spec calls these "modes" — which layer the grid is currently editable in. */
export type Mode = "terrain" | "walls" | "items" | "features";

/** Terrain tool "start" isn't a CellChar — placing it moves level.start instead of painting a cell. */
export type TerrainTool = CellChar | "start";

export type FeatureTool = WallFeature["type"];

/** "auto" clears any override, falling back to the deterministic per-cell hash. */
export type WallTool = WallVariantId | "auto";

export type Selection =
  | { kind: "door"; id: string }
  | { kind: "item"; id: string }
  | { kind: "feature"; id: string }
  | { kind: "start" };
