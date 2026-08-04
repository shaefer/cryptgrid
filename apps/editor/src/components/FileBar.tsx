import { useRef, useState } from "react";
import type { LevelJSON } from "@cryptgrid/sim";
import { createBlankLevel } from "../levelDraft";

export interface FileBarProps {
  level: LevelJSON;
  onLoad: (level: LevelJSON) => void;
}

/** New/Import/Export/Load-vault01 — the "Editor-to-repo flow" entry points (docs/LEVELS.md). */
export function FileBar({ level, onLoad }: FileBarProps) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [newSize, setNewSize] = useState({ width: 16, height: 16 });
  const [status, setStatus] = useState<string | null>(null);

  const flash = (message: string): void => {
    setStatus(message);
    setTimeout(() => setStatus(null), 2500);
  };

  const exportJson = (): void => {
    const blob = new Blob([JSON.stringify(level, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${level.id || "level"}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash(`Exported ${level.id}.json`);
  };

  const importJson = (file: File): void => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as LevelJSON;
        onLoad(parsed);
        flash(`Loaded ${file.name}`);
      } catch (err) {
        flash(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    reader.readAsText(file);
  };

  const loadVault01 = async (): Promise<void> => {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}levels/vault01.json`);
      const parsed = (await res.json()) as LevelJSON;
      onLoad(parsed);
      flash("Loaded vault01.json");
    } catch (err) {
      flash(`Couldn't load vault01.json: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button style={button} onClick={loadVault01}>
        Load vault01
      </button>
      <button style={button} onClick={() => fileInput.current?.click()}>
        Import…
      </button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) importJson(file);
          e.target.value = "";
        }}
      />
      <button style={button} onClick={exportJson}>
        Export
      </button>
      <span style={{ width: 1, height: 20, background: "#3a3d42" }} />
      <input
        type="number"
        min={3}
        max={64}
        value={newSize.width}
        onChange={(e) => setNewSize((s) => ({ ...s, width: Number(e.target.value) }))}
        style={sizeInput}
      />
      <span style={{ fontSize: 12, opacity: 0.6 }}>×</span>
      <input
        type="number"
        min={3}
        max={64}
        value={newSize.height}
        onChange={(e) => setNewSize((s) => ({ ...s, height: Number(e.target.value) }))}
        style={sizeInput}
      />
      <button style={button} onClick={() => onLoad(createBlankLevel(newSize.width, newSize.height))}>
        New
      </button>
      {status && <span style={{ fontSize: 12, opacity: 0.75, fontStyle: "italic" }}>{status}</span>}
    </div>
  );
}

const button: React.CSSProperties = {
  padding: "6px 12px",
  background: "#1a1b1f",
  border: "1px solid #3a3d42",
  color: "#c9c4b8",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 12,
};

const sizeInput: React.CSSProperties = {
  width: 48,
  background: "#0d0e12",
  border: "1px solid #3a3d42",
  borderRadius: 3,
  color: "#c9c4b8",
  padding: "5px 4px",
  fontSize: 12,
};
