import { useEffect, useRef, useState } from "react";
import type { LevelJSON } from "@cryptgrid/sim";
import { FileBar } from "./components/FileBar";
import { GridCanvas } from "./components/GridCanvas";
import { JsonPane } from "./components/JsonPane";
import { PropertyPanel } from "./components/PropertyPanel";
import { Toolbar } from "./components/Toolbar";
import { createBlankLevel } from "./levelDraft";
import type { FeatureTool, Mode, Selection, TerrainTool, WallTool } from "./types";

const STORAGE_KEY = "cryptgrid-editor-level";

function loadInitialLevel(): LevelJSON {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return JSON.parse(saved) as LevelJSON;
    } catch {
      // fall through to a blank level — a corrupt autosave shouldn't brick the editor
    }
  }
  return createBlankLevel(16, 16);
}

export function App() {
  const [level, setLevel] = useState<LevelJSON>(loadInitialLevel);
  const [mode, setMode] = useState<Mode>("terrain");
  const [terrainTool, setTerrainTool] = useState<TerrainTool>("#");
  const [itemTool, setItemTool] = useState("torch");
  const [featureTool, setFeatureTool] = useState<FeatureTool>("switch");
  const [wallTool, setWallTool] = useState<WallTool>("stone");
  const [selection, setSelection] = useState<Selection | null>(null);

  // Captured synchronously during the initial render, before any effect can
  // write to localStorage — reading it back inside an effect would always see
  // the current session's own autosave and think a save already existed.
  const hadSavedLevel = useRef(localStorage.getItem(STORAGE_KEY) !== null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(level));
  }, [level]);

  // On mount, prefer vault01.json over an empty autosave so the editor opens
  // onto real content the first time — but never clobber a genuine autosave.
  useEffect(() => {
    if (hadSavedLevel.current) return;
    fetch(`${import.meta.env.BASE_URL}levels/vault01.json`)
      .then((res) => res.json() as Promise<LevelJSON>)
      .then(setLevel)
      .catch(() => {
        /* stay on the blank level — vault01 just isn't reachable here */
      });
    // Deliberately empty deps — mount-only. STORAGE_KEY is a module constant, not reactive state.
  }, []);

  const handleLoad = (next: LevelJSON): void => {
    setLevel(next);
    setSelection(null);
  };

  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 16, minHeight: "100vh" }}>
      <div>
        <h1 style={{ fontSize: 18, margin: 0, marginBottom: 4 }}>Cryptgrid Level Editor</h1>
        <FileBar level={level} onLoad={handleLoad} />
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
        <Toolbar
          mode={mode}
          onModeChange={setMode}
          terrainTool={terrainTool}
          onTerrainToolChange={setTerrainTool}
          itemTool={itemTool}
          onItemToolChange={setItemTool}
          featureTool={featureTool}
          onFeatureToolChange={setFeatureTool}
          wallTool={wallTool}
          onWallToolChange={setWallTool}
        />

        <div style={{ overflow: "auto", border: "1px solid #3a3d42", borderRadius: 4 }}>
          <GridCanvas
            level={level}
            mode={mode}
            terrainTool={terrainTool}
            itemTool={itemTool}
            featureTool={featureTool}
            wallTool={wallTool}
            selection={selection}
            onSelect={setSelection}
            onChange={setLevel}
          />
        </div>

        <PropertyPanel
          level={level}
          selection={selection}
          onChange={setLevel}
          onSelect={setSelection}
          onMetaChange={(patch) => setLevel((l) => ({ ...l, ...patch }))}
        />

        <JsonPane level={level} onApply={handleLoad} />
      </div>
    </div>
  );
}
