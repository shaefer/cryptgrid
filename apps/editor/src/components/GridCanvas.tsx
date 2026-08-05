import { useCallback, useRef } from "react";
import {
  autoWallVariant,
  FACING_DELTA,
  FACINGS,
  ITEM_REGISTRY,
  type Facing,
  type LevelJSON,
  type WallVariantId,
} from "@cryptgrid/sim";
import {
  cellAt,
  paintTerrain,
  placeFeature,
  placeItem,
  removeFeature,
  removeItem,
  setStart,
  setWallOverride,
} from "../levelDraft";
import type { FeatureTool, Mode, Selection, TerrainTool, WallTool } from "../types";

const CELL_PX = 36;

const TERRAIN_COLOR: Record<string, string> = {
  ".": "#8a7a5c",
  "#": "#5a5d64",
  X: "#0a0a0c",
  D: "#6b4a2a",
  S: "#5a5d64",
};

const WALL_VARIANT_TINT: Record<WallVariantId, string> = {
  stone: "#5a5d64",
  fieldstone: "#5d574d",
  thinbrick: "#6b4a3f",
  "stone-fieldstone": "#787060",
  "stone-thinbrick": "#7a6058",
  "fieldstone-thinbrick": "#7a5f4f",
};

const FEATURE_COLOR: Record<string, string> = {
  switch: "#c9a24a",
  lever: "#d98a3a",
  alcove: "#8a5fc9",
  inscription: "#4a90c9",
};

function itemColor(type: string): string {
  const known = type in ITEM_REGISTRY;
  return known ? "#5fbf6f" : "#c94a4a";
}

const SLOT_OFFSET: Record<string, { dx: number; dz: number }> = {
  center: { dx: 0, dz: 0 },
  ne: { dx: 0.28, dz: -0.28 },
  se: { dx: 0.28, dz: 0.28 },
  nw: { dx: -0.28, dz: -0.28 },
  sw: { dx: -0.28, dz: 0.28 },
};

export interface GridCanvasProps {
  level: LevelJSON;
  mode: Mode;
  terrainTool: TerrainTool;
  itemTool: string;
  featureTool: FeatureTool;
  wallTool: WallTool;
  selection: Selection | null;
  onSelect: (selection: Selection | null) => void;
  onChange: (next: LevelJSON) => void;
}

/**
 * The grid painter (docs/LEVELS.md "EDITOR SPEC"). All 4 layers render at
 * once for spatial context — terrain always, wall-override badges / item
 * dots / feature ticks dimmed unless their mode is active — but only the
 * active mode's layer takes pointer events, so switching modes never hides
 * what you already built elsewhere.
 */
export function GridCanvas({
  level,
  mode,
  terrainTool,
  itemTool,
  featureTool,
  wallTool,
  selection,
  onSelect,
  onChange,
}: GridCanvasProps) {
  const paintButton = useRef<0 | 2 | null>(null);

  const paintAt = useCallback(
    (x: number, z: number, button: 0 | 2) => {
      const before = cellAt(level, x, z);
      const tool = button === 2 ? "." : terrainTool;
      if (tool === "start") {
        onChange(setStart(level, x, z));
        onSelect({ kind: "start" });
        return;
      }
      if (before === tool && (tool === "D" || tool === "S")) {
        const door = level.doors.find((d) => d.x === x && d.z === z);
        if (door) onSelect({ kind: "door", id: door.id });
        return;
      }
      onChange(paintTerrain(level, x, z, tool));
    },
    [level, terrainTool, onChange, onSelect],
  );

  const onCellMouseDown = (x: number, z: number, event: React.MouseEvent) => {
    if (mode !== "terrain") return;
    event.preventDefault();
    const button = event.button === 2 ? 2 : 0;
    paintButton.current = button;
    paintAt(x, z, button);
  };

  const onCellMouseEnter = (x: number, z: number) => {
    if (mode !== "terrain" || paintButton.current === null) return;
    paintAt(x, z, paintButton.current);
  };

  const onWallClick = (x: number, z: number) => {
    if (mode !== "walls") return;
    const ch = cellAt(level, x, z);
    if (ch !== "#" && ch !== "X") return;
    onChange(setWallOverride(level, x, z, wallTool === "auto" ? null : wallTool));
  };

  const onSlotClick = (x: number, z: number, slot: string, event: React.MouseEvent) => {
    if (mode !== "items") return;
    const existing = level.items.find(
      (i) => i.x === x && i.z === z && (i.slot ?? "center") === slot,
    );
    if (event.type === "contextmenu") {
      event.preventDefault();
      if (existing) onChange(removeItem(level, existing.id));
      return;
    }
    if (existing) {
      onSelect({ kind: "item", id: existing.id });
      return;
    }
    onChange(placeItem(level, x, z, slot as Parameters<typeof placeItem>[3], itemTool));
  };

  const onFeatureTickClick = (x: number, z: number, face: Facing, event: React.MouseEvent) => {
    if (mode !== "features") return;
    const existing = level.wallFeatures.find((f) => f.x === x && f.z === z && f.face === face);
    if (event.type === "contextmenu") {
      event.preventDefault();
      if (existing) onChange(removeFeature(level, existing.id));
      return;
    }
    if (existing) {
      onSelect({ kind: "feature", id: existing.id });
      return;
    }
    onChange(placeFeature(level, x, z, face, featureTool));
  };

  const width = level.width * CELL_PX;
  const height = level.height * CELL_PX;

  const cells: React.ReactNode[] = [];
  const wallBadges: React.ReactNode[] = [];
  const itemMarkers: React.ReactNode[] = [];
  const featureTicks: React.ReactNode[] = [];

  for (let z = 0; z < level.height; z++) {
    for (let x = 0; x < level.width; x++) {
      const ch = cellAt(level, x, z) ?? "X";
      const px = x * CELL_PX;
      const pz = z * CELL_PX;

      cells.push(
        <rect
          key={`cell-${x}-${z}`}
          x={px}
          y={pz}
          width={CELL_PX}
          height={CELL_PX}
          fill={TERRAIN_COLOR[ch] ?? "#000"}
          stroke="#16171c"
          strokeWidth={1}
          style={{ cursor: mode === "terrain" ? "pointer" : "default" }}
          onMouseDown={(e) => onCellMouseDown(x, z, e)}
          onMouseEnter={() => onCellMouseEnter(x, z)}
          onContextMenu={(e) => {
            if (mode === "terrain") e.preventDefault();
          }}
        />,
      );

      if (ch === "S") {
        cells.push(
          <line
            key={`secret-${x}-${z}`}
            x1={px + 4}
            y1={pz + 4}
            x2={px + CELL_PX - 4}
            y2={pz + CELL_PX - 4}
            stroke="#c94a4a"
            strokeDasharray="3,2"
            pointerEvents="none"
          />,
        );
      }

      if (ch === "#" || ch === "X") {
        const variant = wallVariantAt(level, x, z);
        const hasOverride = (level.wallOverrides ?? []).some((o) => o.x === x && o.z === z);
        wallBadges.push(
          <rect
            key={`wall-${x}-${z}`}
            x={px + 4}
            y={pz + 4}
            width={CELL_PX - 8}
            height={CELL_PX - 8}
            fill={WALL_VARIANT_TINT[variant]}
            stroke={hasOverride ? "#e8d9a0" : "none"}
            strokeWidth={hasOverride ? 2 : 0}
            opacity={mode === "walls" ? 1 : 0.35}
            pointerEvents={mode === "walls" ? "auto" : "none"}
            style={{ cursor: mode === "walls" ? "pointer" : "default" }}
            onClick={() => onWallClick(x, z)}
          />,
        );
      }

      if (ch === ".") {
        for (const [slot, offset] of Object.entries(SLOT_OFFSET)) {
          const item = level.items.find(
            (i) => i.x === x && i.z === z && (i.slot ?? "center") === slot,
          );
          const cx = px + CELL_PX / 2 + offset.dx * CELL_PX;
          const cy = pz + CELL_PX / 2 + offset.dz * CELL_PX;
          const isSelected = item && selection?.kind === "item" && selection.id === item.id;
          itemMarkers.push(
            <circle
              key={`slot-${x}-${z}-${slot}`}
              cx={cx}
              cy={cy}
              r={8}
              // "none" isn't a paint operation in SVG, so it never hit-tests — an
              // empty slot's circle would be unclickable in its whole interior,
              // not just visually invisible. "transparent" is alpha:0 but still
              // "painted," so the full radius stays a real click target.
              fill={item ? itemColor(item.type) : "transparent"}
              stroke={isSelected ? "#ffffff" : item ? "#16171c" : "#8a7a5c"}
              strokeWidth={isSelected ? 2 : 1}
              opacity={mode === "items" ? 1 : item ? 0.5 : 0}
              pointerEvents={mode === "items" ? "auto" : "none"}
              style={{ cursor: mode === "items" ? "pointer" : "default" }}
              onClick={(e) => onSlotClick(x, z, slot, e)}
              onContextMenu={(e) => onSlotClick(x, z, slot, e)}
            />,
          );
        }
      }

      for (const face of FACINGS) {
        const delta = FACING_DELTA[face];
        const nx = x + delta.dx;
        const nz = z + delta.dz;
        const neighbor = cellAt(level, nx, nz);
        const bordersWall = neighbor === "#" || neighbor === "X" || neighbor === "D" || neighbor === "S";
        if (ch !== "." || !bordersWall) continue;

        const feature = level.wallFeatures.find((f) => f.x === x && f.z === z && f.face === face);
        const isSelected = feature && selection?.kind === "feature" && selection.id === feature.id;
        const tickLength = CELL_PX * 0.4;
        const midX = px + CELL_PX / 2;
        const midY = pz + CELL_PX / 2;
        const edgeX = midX + delta.dx * (CELL_PX / 2);
        const edgeY = midY + delta.dz * (CELL_PX / 2);
        // Perpendicular to the edge direction, so the tick reads as "on that wall."
        const perpX = delta.dz !== 0 ? tickLength / 2 : 0;
        const perpY = delta.dx !== 0 ? tickLength / 2 : 0;

        featureTicks.push(
          <g key={`feat-${x}-${z}-${face}`}>
            {/* A thin stroke is a thin hit-target — SVG only hit-tests the painted
                stroke itself, not a padded box around it. A wide transparent
                twin underneath carries the click, same fix as the item slots. */}
            <line
              x1={edgeX - perpX}
              y1={edgeY - perpY}
              x2={edgeX + perpX}
              y2={edgeY + perpY}
              stroke="transparent"
              strokeWidth={14}
              opacity={mode === "features" ? 1 : 0}
              pointerEvents={mode === "features" ? "auto" : "none"}
              style={{ cursor: mode === "features" ? "pointer" : "default" }}
              onClick={(e) => onFeatureTickClick(x, z, face, e)}
              onContextMenu={(e) => onFeatureTickClick(x, z, face, e)}
            />
            <line
              x1={edgeX - perpX}
              y1={edgeY - perpY}
              x2={edgeX + perpX}
              y2={edgeY + perpY}
              stroke={feature ? FEATURE_COLOR[feature.type] : "#c9c4b8"}
              strokeWidth={isSelected ? 6 : feature ? 5 : 2}
              strokeLinecap="round"
              opacity={mode === "features" ? 1 : feature ? 0.5 : 0}
              pointerEvents="none"
            />
          </g>,
        );
      }
    }
  }

  const startPx = level.start.x * CELL_PX + CELL_PX / 2;
  const startPz = level.start.z * CELL_PX + CELL_PX / 2;
  const startRotation: Record<Facing, number> = { N: 0, E: 90, S: 180, W: 270 };

  return (
    <svg
      width={width}
      height={height}
      style={{ background: "#0d0e12", display: "block", userSelect: "none" }}
      onMouseUp={() => (paintButton.current = null)}
      onMouseLeave={() => (paintButton.current = null)}
    >
      {cells}
      {wallBadges}
      {itemMarkers}
      {featureTicks}
      <polygon
        points="0,-9 7,7 0,3 -7,7"
        fill="#e8d9a0"
        stroke="#16171c"
        transform={`translate(${startPx},${startPz}) rotate(${startRotation[level.start.facing]})`}
        pointerEvents={mode === "terrain" && terrainTool === "start" ? "auto" : "none"}
        style={{ cursor: "pointer" }}
        onClick={() => onSelect({ kind: "start" })}
      />
    </svg>
  );
}

function wallVariantAt(level: LevelJSON, x: number, z: number): WallVariantId {
  const override = (level.wallOverrides ?? []).find((o) => o.x === x && o.z === z);
  return override ? override.variant : autoWallVariant(x, z);
}
