import {
  ITEM_REGISTRY,
  resolveItemSlot,
  type Facing,
  type LevelJSON,
  type SwitchAction,
} from "@cryptgrid/sim";
import {
  addAlcoveItem,
  removeAlcoveItem,
  removeFeature,
  removeItem,
  setStartFacing,
  setSwitchSecret,
  toggleSwitchTarget,
  updateDoor,
  updateFeature,
  updateItem,
} from "../levelDraft";
import type { Selection } from "../types";

export interface PropertyPanelProps {
  level: LevelJSON;
  selection: Selection | null;
  onChange: (next: LevelJSON) => void;
  onSelect: (selection: Selection | null) => void;
  onMetaChange: (patch: Partial<Pick<LevelJSON, "id" | "name">>) => void;
}

const FACINGS: Facing[] = ["N", "E", "S", "W"];
const ACTIONS: SwitchAction[] = ["toggle", "open", "close"];

/** Contextual form for whatever's selected on the grid — the sidebar half of every editor mode. */
export function PropertyPanel({ level, selection, onChange, onSelect, onMetaChange }: PropertyPanelProps) {
  if (!selection) {
    return (
      <div style={panel}>
        <div style={title}>Level</div>
        <label style={field}>
          <span style={label}>Id</span>
          <input
            style={input}
            value={level.id}
            onChange={(e) => onMetaChange({ id: e.target.value })}
          />
        </label>
        <label style={field}>
          <span style={label}>Name</span>
          <input
            style={input}
            value={level.name}
            onChange={(e) => onMetaChange({ name: e.target.value })}
          />
        </label>
        <div style={hint}>{level.width}×{level.height} · click something on the grid to edit it</div>
      </div>
    );
  }

  if (selection.kind === "start") {
    return (
      <div style={panel}>
        <div style={title}>Start position</div>
        <div style={hint}>
          ({level.start.x},{level.start.z})
        </div>
        <div style={row}>
          {FACINGS.map((f) => (
            <button
              key={f}
              style={smallButton(level.start.facing === f)}
              onClick={() => onChange(setStartFacing(level, f))}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (selection.kind === "door") {
    const door = level.doors.find((d) => d.id === selection.id);
    if (!door) return null;
    return (
      <div style={panel}>
        <div style={title}>Door — {door.id}</div>
        <div style={hint}>
          ({door.x},{door.z}) · {door.type}
        </div>
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={door.open}
            onChange={(e) => onChange(updateDoor(level, door.id, { open: e.target.checked }))}
          />
          Open by default
        </label>
        <div style={hint}>To remove: repaint its cell as Floor in Terrain mode.</div>
      </div>
    );
  }

  if (selection.kind === "item") {
    const item = level.items.find((i) => i.id === selection.id);
    if (!item) return null;
    return (
      <div style={panel}>
        <div style={title}>Item — {item.id}</div>
        <div style={hint}>
          ({item.x},{item.z}) · slot {resolveItemSlot(item)}
        </div>
        <label style={field}>
          <span style={label}>Type</span>
          <select
            style={input}
            value={item.type}
            onChange={(e) => onChange(updateItem(level, item.id, { type: e.target.value }))}
          >
            {Object.keys(ITEM_REGISTRY).map((id) => (
              <option key={id} value={id}>
                {ITEM_REGISTRY[id]?.name ?? id}
              </option>
            ))}
          </select>
        </label>
        <button
          style={dangerButton}
          onClick={() => {
            onChange(removeItem(level, item.id));
            onSelect(null);
          }}
        >
          Delete
        </button>
      </div>
    );
  }

  const feature = level.wallFeatures.find((f) => f.id === selection.id);
  if (!feature) return null;

  return (
    <div style={panel}>
      <div style={title}>
        {feature.type[0]!.toUpperCase() + feature.type.slice(1)} — {feature.id}
      </div>
      <div style={hint}>
        ({feature.x},{feature.z}) face {feature.face}
      </div>

      {(feature.type === "switch" || feature.type === "lever") && (
        <>
          <label style={field}>
            <span style={label}>Action</span>
            <select
              style={input}
              value={feature.action}
              onChange={(e) =>
                onChange(updateFeature(level, feature.id, { action: e.target.value as SwitchAction }))
              }
            >
              {ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {feature.type === "switch" && (
            <label style={checkboxRow}>
              <input
                type="checkbox"
                checked={feature.variant === "secretBrick"}
                onChange={(e) => onChange(setSwitchSecret(level, feature.id, e.target.checked))}
              />
              Secret (hidden in the wall, tell blends with its stone)
            </label>
          )}
          <div style={field}>
            <span style={label}>Targets</span>
            {level.doors.map((d) => (
              <label key={d.id} style={checkboxRow}>
                <input
                  type="checkbox"
                  checked={feature.targets.includes(d.id)}
                  onChange={() => onChange(toggleSwitchTarget(level, feature.id, d.id))}
                />
                door: {d.id}
              </label>
            ))}
            {level.wallFeatures
              .filter((f) => f.type === "alcove")
              .map((a) => (
                <label key={a.id} style={checkboxRow}>
                  <input
                    type="checkbox"
                    checked={feature.targets.includes(a.id)}
                    onChange={() => onChange(toggleSwitchTarget(level, feature.id, a.id))}
                  />
                  alcove: {a.id}
                </label>
              ))}
            {level.doors.length === 0 && level.wallFeatures.every((f) => f.type !== "alcove") && (
              <div style={hint}>No doors or alcoves to target yet.</div>
            )}
          </div>
        </>
      )}

      {feature.type === "alcove" && (
        <>
          <label style={checkboxRow}>
            <input
              type="checkbox"
              checked={feature.hidden ?? false}
              onChange={(e) => onChange(updateFeature(level, feature.id, { hidden: e.target.checked }))}
            />
            Hidden until revealed by a switch
          </label>
          <div style={field}>
            <span style={label}>Items on the shelf</span>
            {feature.items.map((item) => (
              <div key={item.id} style={row}>
                <span style={{ fontSize: 12, flex: 1 }}>
                  {ITEM_REGISTRY[item.type]?.name ?? item.type}
                </span>
                <button
                  style={smallButton(false)}
                  onClick={() => onChange(removeAlcoveItem(level, feature.id, item.id))}
                >
                  ×
                </button>
              </div>
            ))}
            <select
              style={input}
              value=""
              onChange={(e) => {
                if (e.target.value) onChange(addAlcoveItem(level, feature.id, e.target.value));
              }}
            >
              <option value="">+ add item…</option>
              {Object.keys(ITEM_REGISTRY).map((id) => (
                <option key={id} value={id}>
                  {ITEM_REGISTRY[id]?.name ?? id}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      {feature.type === "inscription" && (
        <label style={field}>
          <span style={label}>Text</span>
          <textarea
            style={{ ...input, height: 60, resize: "vertical" }}
            value={feature.text}
            onChange={(e) => onChange(updateFeature(level, feature.id, { text: e.target.value }))}
          />
        </label>
      )}

      <button
        style={dangerButton}
        onClick={() => {
          onChange(removeFeature(level, feature.id));
          onSelect(null);
        }}
      >
        Delete
      </button>
    </div>
  );
}

const panel: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  width: 240,
  background: "#1a1b1f",
  border: "1px solid #3a3d42",
  borderRadius: 4,
  padding: 12,
};

const title: React.CSSProperties = { fontSize: 13, letterSpacing: "0.04em" };
const hint: React.CSSProperties = { fontSize: 11, opacity: 0.55, fontStyle: "italic", lineHeight: 1.4 };
const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 3 };
const label: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", opacity: 0.55 };
const row: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6 };
const checkboxRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 6, fontSize: 12 };
const input: React.CSSProperties = {
  background: "#0d0e12",
  border: "1px solid #3a3d42",
  borderRadius: 3,
  color: "#c9c4b8",
  padding: "4px 6px",
  fontSize: 12,
  fontFamily: "inherit",
};
const dangerButton: React.CSSProperties = {
  padding: "6px 10px",
  background: "#2a1616",
  border: "1px solid #6b3a3a",
  color: "#e8a0a0",
  borderRadius: 3,
  cursor: "pointer",
  fontSize: 12,
};
function smallButton(active: boolean): React.CSSProperties {
  return {
    padding: "2px 8px",
    background: active ? "#3a3220" : "#0d0e12",
    border: `1px solid ${active ? "#c9a24a" : "#3a3d42"}`,
    color: active ? "#e8d9a0" : "#c9c4b8",
    borderRadius: 3,
    cursor: "pointer",
    fontSize: 12,
  };
}
