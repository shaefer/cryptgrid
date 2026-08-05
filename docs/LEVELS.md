# LEVELS.md — Level Format

The level JSON is the shared contract between `apps/editor`, `apps/game`, `packages/sim`, and (later) `apps/server`. Keep it hand-editable: a human should be able to sketch a level in a text editor.

## Coordinates & facing

- Grid coordinates: `x` = column (east positive), `z` = row (south positive). `(0,0)` is the northwest corner. Maps directly onto Three.js x/z; world position = `(x*3+1.5, _, z*3+1.5)`.
- Facing: `"N" | "E" | "S" | "W"`. North = −z. Wall **faces** are named by the direction the face's *normal* points into the cell that sees it: a feature on the south wall of a corridor cell is attached to that cell with `face: "S"`.
- Floor items sit at one of 4 sub-tile quadrant positions (see `items[].slot` below), offset ±0.75 world units (`tileSize/4`) from the tile's center along both axes. No "center" slot: a center-slotted item was unreachable from any adjacent tile (always exactly 1 tile from a neighbor's own center, outside `PICKUP_RANGE_TILES`) and off-camera while standing on it — every quadrant has a near half reachable from next door.

## Schema (v1)

```jsonc
{
  "formatVersion": 1,
  "id": "vault01",
  "name": "The Outer Vault",
  "width": 16,
  "height": 16,

  // One string per row, one char per cell. Base terrain only.
  //  '#' wall   '.' floor   'D' door (closed)   'S' secret door (hidden)
  //  'X' void (out of bounds filler, treated as wall)
  "cells": [
    "################",
    "#....#.........#",
    "..."
  ],

  "start": { "x": 1, "z": 1, "facing": "E" },

  // Doors & secret doors: keyed by cell position; id lets triggers target them.
  "doors": [
    { "id": "door_hall", "x": 5, "z": 1, "type": "portcullis", "open": false },
    { "id": "secret_a", "x": 9, "z": 4, "type": "secret", "open": false }
  ],

  // Wall-mounted interactables and decorations.
  "wallFeatures": [
    { "id": "sw_hidden1", "x": 8, "z": 4, "face": "N", "type": "switch",
      "variant": "secretBrick", "targets": ["secret_a"], "action": "toggle" },
    { "id": "lever_1", "x": 3, "z": 2, "face": "E", "type": "lever",
      "targets": ["door_hall"], "action": "toggle" },
    { "id": "alc_1", "x": 6, "z": 3, "face": "S", "type": "alcove",
      "items": ["itm_torch_1"] },
    // "hidden": true alcoves render as plain wall (no tell of their own —
    // only switches get one) until a switch/lever targeting their id fires.
    { "id": "alc_hidden1", "x": 10, "z": 7, "face": "N", "type": "alcove",
      "hidden": true, "items": ["itm_scroll_2"] },
    { "id": "txt_1", "x": 2, "z": 1, "face": "N", "type": "inscription",
      "text": "The vault keeps what the vault is given." }
  ],

  // Items lying on floor tiles (alcove items live in the feature above).
  // "slot" is optional: "ne" | "se" | "nw" | "sw" — omitted = a quadrant
  // picked deterministically from the item's own id (packages/sim/src/level/query.ts's
  // resolveItemSlot), so a slot-less item still resolves consistently and
  // reaches every pickup-range check the same way every time.
  // Up to 4 items can share one tile, one per quadrant.
  "items": [
    { "id": "itm_sword_1", "type": "shortsword", "x": 4, "z": 2 },
    { "id": "itm_bread_1", "type": "bread", "x": 6, "z": 6, "slot": "ne" },
    { "id": "itm_flask_1", "type": "waterflask", "x": 6, "z": 7 }
  ],

  // Optional, sparse (M0.10) — forces a specific wall look at a specific wall
  // cell, overriding the deterministic auto-pick (packages/sim/src/hash.ts).
  // Most wall cells have no entry here and fall back to the hash. `variant`
  // is one of 6 (M0.11): the 3 base looks "stone"|"fieldstone"|"thinbrick",
  // or one of the 3 pairwise transitions "stone-fieldstone"|"stone-thinbrick"
  // |"fieldstone-thinbrick" — transitions are editor-authored only, never
  // picked by the automatic hash (which only ever chooses among the 3 base looks).
  "wallOverrides": [
    { "x": 9, "z": 4, "variant": "thinbrick" },
    { "x": 8, "z": 4, "variant": "stone-thinbrick" }
  ],

  // Future-proof stubs (empty arrays fine in v1):
  "triggers": [],   // floor plates, tile-enter events (M1+)
  "spawns": []      // monsters (M1+)
}
```

## Item type registry

Item *types* (display name, sprite, stackable, weight, throwable, consumable effects, equip slot) live in code: `packages/sim/src/items/registry.ts`. `weight` (required, abstract units — see STATS.md "Carrying capacity") and `throwable` (optional; whether a held copy can eventually be thrown — M0.7 only sets the flag, throwing itself is a later milestone) join the existing fields starting M0.7. Levels reference types by string key. M0 registry: `shortsword`, `torch`, `bread` (+food), `waterflask` (+water), `ironkey` (unlocks — M1), `scroll` (flavor).

## Runtime state vs. authored data

The sim parses authored JSON into `LevelRuntime`: cells become a typed grid; doors/features/items get mutable state (`open`, `pressed`, `taken`). Authored files are never mutated. Save games (later) serialize the runtime deltas.

## Validation

`packages/sim/src/level/validate.ts` — loadable from editor, game, and tests: rectangular `cells` matching width/height; `start` on floor; doors on `D`/`S` cells and vice versa; features attached to a wall that exists (the referenced face must border a wall or door cell); unique ids; `targets` resolve (against door ids **or**, starting M0.8, alcove feature ids — a switch can reveal a hidden alcove the same way it opens a secret door); items on floor cells; starting M0.7, no two items may share the same `(x, z, slot)` — slot defaults to `"center"` when omitted, so this also catches two centerless items stacked on one tile; starting M0.10, each `wallOverrides` entry must target an actual wall cell (`#`/`X`, never a door or floor cell), name a known variant id (6 as of M0.11 — see the schema above), and appear at most once per cell. The editor runs this live (every edit, not just on export) and lists errors inline.

# EDITOR SPEC (apps/editor)

A React + SVG grid painter (`apps/editor/src`). Function over beauty — but keep it pleasant, you'll live in it. Built in M0.10; works directly against `LevelJSON` from `@cryptgrid/sim` (no separate editor-only shape), and shares `tools/viteSharedData.mjs` with `apps/game` so both dev servers and both production builds serve `/levels/*` and `/assets/*` identically.

## M0.10 editor (shipped)

Four modes, one grid. All four layers render at once for spatial context — terrain always at full strength; wall-override badges, item dots, and feature ticks dim to ~35-50% opacity and stop taking pointer events when their mode isn't active — so switching modes never hides what you already built elsewhere, it only changes what's currently editable.

- **Terrain mode:** paint tools — Floor, Wall, Void, Door, Secret Door, Start (keys 1–6). Click-drag paints; right-click erases to floor. Painting Door/Secret Door auto-creates a matching `doors[]` entry (auto id, sensible defaults); painting anything else over an existing door cell removes it — the grid and `doors[]` never drift apart. Clicking an already-painted door cell with the matching tool selects it for editing instead of no-op-repainting.
- **Walls mode:** a tool palette like Terrain/Items/Features (M0.11 replaced an earlier click-to-cycle interaction once the option count grew to 7) — Auto, the 3 base looks, and the 3 pairwise transitions. Pick a tool, click a wall cell (`#`/`X`) to paint it; Auto clears the cell's `wallOverrides` entry back to the deterministic per-cell hash. A gold outline marks a cell with an authored override so it reads differently from the auto-pick at a glance.
- **Items mode:** each floor cell exposes its 4 sub-tile quadrant slots (`docs/LEVELS.md` "Coordinates & facing" — no "center" slot). Pick a type from the toolbar, click an empty slot to place it (auto id); click an occupied slot to select it for editing; right-click removes it.
- **Features mode:** floor cells bordering a wall/door render a small tick on each qualifying edge (matching `validate.ts`'s own `feature-face-no-wall` rule, so nothing placeable in the editor can ever fail that check). Pick a feature type, click an empty tick to place it, click an occupied one to edit, right-click removes it. The switch/lever form's targets checklist lists doors *and* alcove ids (M0.8's widened target resolution); the alcove form has a `hidden` checkbox and an add/remove item list; the inscription form is a text box.
- **Property panel:** contextual — shows whatever's selected (door/item/feature/start), or level-wide `id`/`name` fields when nothing is selected.
- **Live JSON pane:** two-way. Grid edits always re-serialize into it; typed edits apply back to the grid on demand (an explicit Apply/Revert pair, not parse-on-keystroke, so a mid-edit invalid JSON string doesn't fight the grid). `validateLevel()` runs on every render against the live level and lists every error inline — the same check the game trusts, so "the editor says it's clean" and "the game will load it" mean the same thing.
- **File bar:** New (with width/height), Import (file picker), Export (browser download), Load vault01 (fetches `levels/vault01.json` from the shared data root). `localStorage` autosaves on every change and reloads on mount; a brand-new session with no autosave prefers `vault01.json` over a blank grid so the editor opens onto real content the first time.
- **Keyboard hit-target note:** SVG's default hit-testing only counts a shape's *painted* area — `fill="none"` and a bare thin `<line>` stroke are both effectively unclickable outside a razor-thin region. Every clickable marker (item slots, feature ticks) pairs its visible shape with a `fill`/`stroke`-`"transparent"` companion sized for an actual click, not just a render. Found the hard way — via Playwright, not by inspection — during M0.10's own verification pass.

## Later (M1+)

Playtest button (opens game with level via URL param or postMessage), multi-floor support, trigger editor, spawn editor, undo/redo, tile-variant painting brush (paint a wall-override region instead of one cell at a time).
