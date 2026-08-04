import { useEffect, useState } from "react";
import { validateLevel, type LevelJSON, type ValidationError } from "@cryptgrid/sim";

export interface JsonPaneProps {
  level: LevelJSON;
  onApply: (next: LevelJSON) => void;
}

/**
 * The live JSON pane (docs/LEVELS.md "EDITOR SPEC") — two-way: grid edits
 * always reflect here; typed edits apply back to the grid on demand. Also
 * the one place validateLevel() runs, since it's the same check the game
 * and editor both trust (LEVELS.md "Validation").
 */
export function JsonPane({ level, onApply }: JsonPaneProps) {
  const [text, setText] = useState(() => JSON.stringify(level, null, 2));
  const [dirty, setDirty] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) setText(JSON.stringify(level, null, 2));
  }, [level, dirty]);

  const errors: ValidationError[] = validateLevel(level);

  const apply = (): void => {
    try {
      const parsed = JSON.parse(text) as LevelJSON;
      setParseError(null);
      setDirty(false);
      onApply(parsed);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 360 }}>
      <div style={row}>
        <div style={title}>Level JSON</div>
        {dirty && (
          <>
            <button style={smallButton(true)} onClick={apply}>
              Apply
            </button>
            <button
              style={smallButton(false)}
              onClick={() => {
                setText(JSON.stringify(level, null, 2));
                setDirty(false);
                setParseError(null);
              }}
            >
              Revert
            </button>
          </>
        )}
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setDirty(true);
        }}
        spellCheck={false}
        style={{
          flex: "0 0 320px",
          background: "#0d0e12",
          border: "1px solid #3a3d42",
          borderRadius: 3,
          color: "#c9c4b8",
          fontFamily: "ui-monospace, monospace",
          fontSize: 11,
          padding: 8,
          resize: "vertical",
        }}
      />
      {parseError && <div style={errorText}>Invalid JSON: {parseError}</div>}

      <div style={title}>
        Validation {errors.length === 0 ? "— clean" : `— ${errors.length} issue${errors.length === 1 ? "" : "s"}`}
      </div>
      <div style={{ maxHeight: 160, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {errors.map((err, i) => (
          <div key={i} style={errorText}>
            [{err.code}] {err.message}
          </div>
        ))}
      </div>
    </div>
  );
}

const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8 };
const title: React.CSSProperties = { fontSize: 12, letterSpacing: "0.04em", opacity: 0.75 };
const errorText: React.CSSProperties = { fontSize: 11, color: "#e8a0a0", lineHeight: 1.4 };
function smallButton(primary: boolean): React.CSSProperties {
  return {
    padding: "3px 10px",
    background: primary ? "#3a3220" : "#1a1b1f",
    border: `1px solid ${primary ? "#c9a24a" : "#3a3d42"}`,
    color: primary ? "#e8d9a0" : "#c9c4b8",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 11,
  };
}
