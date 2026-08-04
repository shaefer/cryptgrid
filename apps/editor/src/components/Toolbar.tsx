import { ITEM_REGISTRY } from "@cryptgrid/sim";
import type { FeatureTool, Mode, TerrainTool } from "../types";

const TERRAIN_TOOLS: { tool: TerrainTool; label: string; key: string }[] = [
  { tool: ".", label: "Floor", key: "1" },
  { tool: "#", label: "Wall", key: "2" },
  { tool: "X", label: "Void", key: "3" },
  { tool: "D", label: "Door", key: "4" },
  { tool: "S", label: "Secret Door", key: "5" },
  { tool: "start", label: "Start", key: "6" },
];

const FEATURE_TOOLS: { tool: FeatureTool; label: string }[] = [
  { tool: "switch", label: "Switch" },
  { tool: "lever", label: "Lever" },
  { tool: "alcove", label: "Alcove" },
  { tool: "inscription", label: "Inscription" },
];

const MODES: { mode: Mode; label: string }[] = [
  { mode: "terrain", label: "Terrain" },
  { mode: "walls", label: "Walls" },
  { mode: "items", label: "Items" },
  { mode: "features", label: "Features" },
];

export interface ToolbarProps {
  mode: Mode;
  onModeChange: (mode: Mode) => void;
  terrainTool: TerrainTool;
  onTerrainToolChange: (tool: TerrainTool) => void;
  itemTool: string;
  onItemToolChange: (type: string) => void;
  featureTool: FeatureTool;
  onFeatureToolChange: (tool: FeatureTool) => void;
}

function button(active: boolean): React.CSSProperties {
  return {
    padding: "6px 10px",
    background: active ? "#3a3220" : "#1a1b1f",
    border: `1px solid ${active ? "#c9a24a" : "#3a3d42"}`,
    color: active ? "#e8d9a0" : "#c9c4b8",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 12,
    textAlign: "left",
  };
}

/** Mode + tool palette (docs/LEVELS.md "EDITOR SPEC": paint/feature/item modes, 1-6 shortcuts). */
export function Toolbar({
  mode,
  onModeChange,
  terrainTool,
  onTerrainToolChange,
  itemTool,
  onItemToolChange,
  featureTool,
  onFeatureToolChange,
}: ToolbarProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 180 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={sectionLabel}>Mode</div>
        {MODES.map(({ mode: m, label }) => (
          <button key={m} style={button(mode === m)} onClick={() => onModeChange(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === "terrain" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={sectionLabel}>Terrain tool</div>
          {TERRAIN_TOOLS.map(({ tool, label, key }) => (
            <button
              key={tool}
              style={button(terrainTool === tool)}
              onClick={() => onTerrainToolChange(tool)}
            >
              {key} · {label}
            </button>
          ))}
          <div style={hint}>Drag to paint · right-click erases to floor</div>
        </div>
      )}

      {mode === "walls" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={sectionLabel}>Wall texture</div>
          <div style={hint}>Click a wall cell to cycle: Auto → Stone → Fieldstone → Hewn → Auto.</div>
        </div>
      )}

      {mode === "items" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={sectionLabel}>Item type</div>
          {Object.keys(ITEM_REGISTRY).map((id) => (
            <button key={id} style={button(itemTool === id)} onClick={() => onItemToolChange(id)}>
              {ITEM_REGISTRY[id]?.name ?? id}
            </button>
          ))}
          <div style={hint}>Click a slot (center/corners) to place · click again to edit · right-click removes</div>
        </div>
      )}

      {mode === "features" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={sectionLabel}>Feature type</div>
          {FEATURE_TOOLS.map(({ tool, label }) => (
            <button key={tool} style={button(featureTool === tool)} onClick={() => onFeatureToolChange(tool)}>
              {label}
            </button>
          ))}
          <div style={hint}>Click a wall-edge tick to place · click again to edit · right-click removes</div>
        </div>
      )}
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  opacity: 0.55,
  marginBottom: 2,
};

const hint: React.CSSProperties = {
  fontSize: 11,
  opacity: 0.55,
  fontStyle: "italic",
  marginTop: 4,
  lineHeight: 1.4,
};
