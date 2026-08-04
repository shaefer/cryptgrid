# LEVELS.md — Level Format

The level JSON is the shared contract between `apps/editor`, `apps/game`, `packages/sim`, and (later) `apps/server`. Keep it hand-editable: a human should be able to sketch a level in a text editor.

## Coordinates & facing

- Grid coordinates: `x` = column (east positive), `z` = row (south positive). `(0,0)` is the northwest corner. Maps directly onto Three.js x/z; world position = `(x*3+1.5, _, z*3+1.5)`.
- Facing: `"N" | "E" | "S" | "W"`. North = −z. Wall **faces** are named by the direction the face's *normal* points into the cell that sees it: a feature on the south wall of a corridor cell is attached to that cell with `face: "S"`.
- Floor items sit at one of 5 sub-tile positions (`center`, or a quadrant — see `items[].slot` below), offset ±0.75 world units (`tileSize/4`) from the tile's center along both axes.

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
  // "slot" is optional: "center" | "ne" | "se" | "nw" | "sw" — omitted = center.
  // Up to 5 items can share one tile, one per slot.
  "items": [
    { "id": "itm_sword_1", "type": "shortsword", "x": 4, "z": 2 },
    { "id": "itm_bread_1", "type": "bread", "x": 6, "z": 6, "slot": "ne" },
    { "id": "itm_flask_1", "type": "waterflask", "x": 6, "z": 7 }
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

`packages/sim/src/level/validate.ts` — loadable from editor, game, and tests: rectangular `cells` matching width/height; `start` on floor; doors on `D`/`S` cells and vice versa; features attached to a wall that exists (the referenced face must border a wall or door cell); unique ids; `targets` resolve (against door ids **or**, starting M0.8, alcove feature ids — a switch can reveal a hidden alcove the same way it opens a secret door); items on floor cells; starting M0.7, no two items may share the same `(x, z, slot)` — slot defaults to `"center"` when omitted, so this also catches two centerless items stacked on one tile. Editor runs this on export and shows errors inline.

# EDITOR SPEC (apps/editor)

A React grid painter. Function over beauty — but keep it pleasant, you'll live in it.

## M0-scope editor (build it right after the game loop runs — see ROADMAP)

- **Canvas grid** (SVG or canvas): paint tools — Wall, Floor, Door, Secret Door, Void, Start Position; click-drag paints; right-click erases to floor.
- **Feature mode:** select a cell edge to attach switch/lever/alcove/inscription; sidebar form edits properties (`variant`, `targets` multi-select with dropdown of door ids, `text`, alcove item list).
- **Item mode:** click a floor cell, pick item type from registry, optional custom id (auto-generated otherwise).
- **Live JSON pane:** the level as formatted JSON, two-way (paste JSON → grid updates). Import/Export buttons (download file / load file). Validation errors displayed inline.
- **Legend + keyboard shortcuts** (1–6 tool select).
- Persistence: browser localStorage autosave of working level + export to file. (Editor-to-repo flow: export JSON, commit to `levels/`.)

## Later (M1+)

Playtest button (opens game with level via URL param or postMessage), multi-floor support, trigger editor, monster spawns, undo/redo, tile-variant painting.
