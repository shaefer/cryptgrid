# ROADMAP.md — Cryptgrid: Vault of Shadows

Work strictly top-down within a milestone. Each step is a committable vertical slice with acceptance criteria (AC). Don't start a milestone early; don't foreclose one either.

## Milestone 0 — "The Vault Breathes" (target: today)

**Definition of done:** deployed to GitHub Pages; a player can explore vault01 at 60fps, loot floor and alcoves, find a secret switch that opens a secret door, watch vitals decay/restore, and cast Light + Firebolt with runes.

### M0.1 — Scaffold
Monorepo (pnpm workspaces, tsconfig.base strict), `packages/sim` + `apps/game` stubs, Vitest + ESLint (incl. sim import restrictions), `ci.yml` (typecheck+test), commands per CLAUDE.md.
**AC:** `pnpm install && pnpm test && pnpm dev` all work; CI green on first PR.

### M0.2 — Sim core: grid, movement, state
Level JSON parse + validate (LEVELS.md), `GameState`, `tick()`, commands MOVE/TURN with cooldowns, wall collision, seeded RNG util. Author `levels/vault01.json` (~16×16; layout must include: a lever-and-portcullis gate, an alcove room, the secret-switch corridor, an inscription teaching Firebolt, scattered items incl. food/water — see LEVELS.md example ids).
**AC:** Vitest covers: move into wall blocked; turn cycles facing; cooldown rejects rapid moves; level validation catches 3+ authored error cases.

### M0.3 — First render
Textures via `tools/gen-textures` (ASSETS.md), Three.js scene from level data (instanced walls/floor/ceiling), camera at party position, torch point-light + fog.
**AC:** vault01 visibly renders; standing at start position matches expectations; 60fps (spot-check devtools).

### M0.4 — Movement feel
Keyboard mapping → commands; 200ms/150ms tweens with ease-out; input buffer (depth 1) for chained held-key movement; wall-bump nudge.
**AC:** Holding W glides down a corridor without hitching; bumping walls feels like a bump, not a bug. **Human checkpoint: Daniel plays it.** Movement feel is the soul of the genre — tune before proceeding.

### M0.5 — Playwright smoke + deploy
Smoke test (load, `data-ready`, screenshot artifact, fail on console errors); `deploy.yml` → GitHub Pages.
**AC:** Live URL playable on phone-a-friend's machine. *(Deliberately early — everything after this ships continuously.)*

### M0.6 — Party & vitals
Character model, 4-slot party (1 filled: pre-made character "Bram of the Ninth Door" or Daniel's choice), vitals with decay/regen rates in sim; DOM HUD bars (5 per character, color-coded, smooth width transitions).
**AC:** Vitest: food/water decay per tick; at 0 food, HP drains. Bars visibly move (dev-speed decay flag for testing).

### M0.7 — Items & inventory
Item registry, floor item sprites, raycast click + `F` interact → PICKUP command; shared inventory DOM panel (click consumables to use → food/water restore); alcoves render + take/place.
**AC:** Vitest: pickup removes from level/adds to inventory; consume restores stat and destroys item; alcove take/place round-trips. In game: loot the alcove room end-to-end.

### M0.8 — Switches, doors, secrets
Lever + portcullis (animated slide, blocks movement while closed); secret-switch wall variant + INTERACT toggle; secret door (wall until opened, grinds aside on event).
**AC:** Vitest: lever toggles door; closed door blocks MOVE; secret switch opens secret door. In game: find the secret brick by eye, click it, watch the wall move. **Human checkpoint: is the secret findable-but-not-obvious?**

### M0.9 — Runes & first spells
Rune data (24 runes, SPELLS.md), glyph generation, HUD rune panel (click + keys 1–6, backspace/esc), pay-per-rune mana deduction, invoke/fizzle; Light (torch radius boost w/ duration) and Firebolt (sim projectile entity, 1 tile/2 ticks, wall impact event + renderer flash).
**AC:** Vitest: mana deducted per rune press; insufficient mana blocks rune; `Kor Ign Dart` spawns projectile; projectile halts at wall; invalid sequence fizzles (mana lost). In game: read the inscription, cast your first Firebolt down a dark corridor. That's the money moment — make the projectile glow and light the walls as it passes (point light parented to projectile).

### M0.10 — Editor v1
`apps/editor` per LEVELS.md editor spec (paint/feature/item modes, JSON pane, validation, import/export, localStorage autosave); deployed to Pages alongside game.
**AC:** Round-trip: edit vault01 in editor → export → game loads it → change persists.

*(M0.10 may slip to tomorrow without shame — M0.1–M0.9 is the "running game by end of day" bar.)*

## Milestone 1 — "Something in the Dark"
Monsters (grid AI: patrol/chase/attack, tile occupancy), melee combat (per-hand cooldowns, front/back rank rules), damage/death/loot, floor triggers + pressure plates + pits, keys/locked doors, SFX pass, 2–3 more spells (Frostbolt, Mend, Healmist), multi-floor levels + stairs, editor: spawns/triggers/playtest button.

## Milestone 2 — "The Long Delve"
Per-character paper-doll inventory + equipment, character creation/party of 4, save/load (runtime delta serialization), rest system, hunger/thirst tuning pass, more essences/forms live, Truesight + subtle-secrets economy, throwing items, doors destructible, content: 4-floor vault campaign, Kenney prop set-dressing pass, ambience audio.

## Milestone 3 — "Delve Together"
`apps/server`: Colyseus room wrapping the sim; command transport; client prediction for own movement; lobby/join-by-code; party = one character per player; Docker → AWS Fargate (ALB, WebSockets); Pages client pointed at server for MP mode while solo remains fully offline.

## Milestone 4 — "Beyond the Browser"
Tauri wrapper → Steam build; gamepad support; options/keybinding UI; Capacitor experiment for mobile w/ touch D-pad + tap-to-interact; performance/battery pass.
