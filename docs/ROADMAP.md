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
Character model, 4-slot party (1 filled: pre-made character "Bram of the Ninth Door" or Daniel's choice). Full progression data model per STATS.md, front-loaded now even though most of it is mechanically inert until later milestones: HP/Mana/Stamina + a merged Hunger/Thirst bar (replaces separate Food/Water) with a hidden Ravenousness tier and an overfeed overflow; the six primary attributes (STR/DEX/CHA/VIT/WIS/INT); all six classes tracked (Fighter/Ranger/Wizard/Priest visible, Rogue/Bard permanently `revealed: false` until M1/M2 add their reveal triggers); hidden per-weapon-type skill stubs; hidden elemental-resistance stubs; sparse spell-mastery tracking shape; armor-tier qualification rules. New `packages/sim/src/character/` (mirrors `level/`, `items/`) and `packages/sim/src/tuning.ts` for every tunable formula (exp curve, decay rates, carry-capacity formula). DOM HUD: **4** vitals bars (not 5) — color-coded, smooth width transitions, Hunger/Thirst with overfeed shown as a second-colored overflow segment and a status label (Gorged…Starving) — plus visible levels for the four revealed classes.
**AC:** Vitest: Hunger/Thirst decays per tick, scaled by Ravenousness tier; status tier transitions match the STATS.md table; at Starving, HP drains. Exp-curve and carry-capacity formulas covered (formulas only — carry capacity isn't enforced until M0.7, nothing exists yet to consume it). Bars visibly move (dev-speed decay flag for testing). Rogue/Bard exist in state but never render on the HUD.

### M0.65 — Character sheet
Compact vitals HUD redesign: renders every *filled* party slot at once (not just slot 0), trimmed padding and shorter bars so up to 4 characters fit on screen together; the Hunger/Thirst status label (Gorged…Starving) moves from its own line to an overlay directly on the bar itself, in a font color that stays legible over any fill color; class levels removed from this compact view. New on-demand character sheet: number keys `1`–`4` open/close/switch a full-panel overlay for that party slot (`Esc` also closes), showing the six attributes (STR/DEX/CHA/VIT/WIS/INT), the four visible classes' **level only** (exp stays hidden — see STATS.md correction below), and an Inventory section that's present but empty, wired up for real once M0.7 has items. Movement input is suppressed while a sheet is open; the sim keeps ticking underneath (vitals still decay in real time) — menus don't pause a real-time dungeon.

Also corrects a documented inconsistency: STATS.md previously said class exp was visible alongside level for the four starting classes; the original design intent was always that exp requires a reveal spell/item (same "requires magic or a specific item" family as Truesight and weapon-skill/resistance/mastery numbers) while level alone is plain-visible. STATS.md's Secrecy section now says this correctly — level and exp were never meant to be revealed together.

**AC:** Pressing `1` opens Bram's sheet; pressing it again closes it; `2`/`3`/`4` show an empty-slot placeholder (no character there yet); switching between slots via number keys works without closing first; `Esc` closes from any state. WASD/QE produce no movement while a sheet is open. Compact HUD is visibly resized/decluttered from M0.6 and reads correctly with the current single filled slot.

### M0.7 — Items & inventory
Item registry (+ weight field; `ConsumableEffect` restructured to `{kind: "food"|"water", amount, bonus?}` per STATS.md, replacing the old `restores: "food"|"water"` shape now that Hunger/Thirst is one bar), floor item sprites, raycast click + `F` interact → PICKUP command (rejected once STR-derived carry capacity, `tuning.ts`, is exceeded — the first real consumer of an attribute); shared inventory DOM panel (click consumables to use → restores Hunger/Thirst, food/water each carrying a small distinct bonus).
**AC:** Vitest: pickup removes from level/adds to inventory; pickup blocked over carry capacity; consume restores Hunger/Thirst and destroys item; alcove take/place round-trips. In game: loot the alcove room end-to-end.

### M0.8 — Switches, doors, secrets
Lever + portcullis (animated slide, blocks movement while closed); secret-switch wall variant + INTERACT toggle; secret door (wall until opened, grinds aside on event).
**AC:** Vitest: lever toggles door; closed door blocks MOVE; secret switch opens secret door. In game: find the secret brick by eye, click it, watch the wall move. **Human checkpoint: is the secret findable-but-not-obvious?**

### M0.9 — Runes & first spells
Rune data (24 runes, SPELLS.md), glyph generation, HUD rune panel (click + keys 1–6, backspace/esc), pay-per-rune mana deduction, invoke/fizzle; Light (torch radius boost w/ duration) and Firebolt (sim projectile entity, 1 tile/2 ticks, wall impact event + renderer flash). Each successful cast increments that spell's mastery counter (STATS.md) — tracked now, inert until M1 makes it affect success chance; M0 stays deterministic per SPELLS.md.
**AC:** Vitest: mana deducted per rune press; insufficient mana blocks rune; `Kor Ign Dart` spawns projectile; projectile halts at wall; invalid sequence fizzles (mana lost); casting increments spell-mastery uses. In game: read the inscription, cast your first Firebolt down a dark corridor. That's the money moment — make the projectile glow and light the walls as it passes (point light parented to projectile).

### M0.10 — Editor v1
`apps/editor` per LEVELS.md editor spec (paint/feature/item modes, JSON pane, validation, import/export, localStorage autosave); deployed to Pages alongside game.
**AC:** Round-trip: edit vault01 in editor → export → game loads it → change persists.

*(M0.10 may slip to tomorrow without shame — M0.1–M0.9 is the "running game by end of day" bar.)*

## Milestone 1 — "Something in the Dark"
Monsters (grid AI: patrol/chase/attack, tile occupancy, CHA-weighted targeting per STATS.md), melee **and ranged (bow)** combat (per-hand cooldowns, front/back rank rules — ranged is Ranger's entire exp source, so it lands here, not later), damage/death/loot, floor triggers + pressure plates + pits, keys **and lockpicking** on locked doors (first successful pick reveals the Rogue class), a poison status effect (groundwork for Rogue's identity, pairs with M2's throwing items), SFX pass, 2–3 more spells (Frostbolt, Mend, Healmist). Weapon-skill growth, STR/DEX damage/dodge, and elemental resistances (STATS.md) all go live here — this is the first milestone anything actually reads them. Spell mastery starts affecting cast-success chance, fulfilling SPELLS.md's deferred "character skill/fizzle-chance systems come later" line. Multi-floor levels + stairs, editor: spawns/triggers/playtest button.

## Milestone 2 — "The Long Delve"
Per-character paper-doll inventory + equipment (armor tiers from STATS.md become wearable here, not just qualified-for), character creation/party of 4, a bard instrument item (first use reveals the Bard class), save/load (runtime delta serialization), rest system, hunger/thirst tuning pass (Ravenousness-tier-shifting effects, status-revealing magic items), more essences/forms live, Truesight + subtle-secrets economy, throwing items, doors destructible, content: 4-floor vault campaign, Kenney prop set-dressing pass, ambience audio.

*Exploratory, unscheduled:* a CHA-driven vendor/haggling economy (STATS.md) has no committed milestone — M2 is its earliest plausible home given the equipment/economy focus above, but this is a candidate to revisit once M2's scope firms up, not a bullet to build against yet.

## Milestone 3 — "Delve Together"
`apps/server`: Colyseus room wrapping the sim; command transport; client prediction for own movement; lobby/join-by-code; party = one character per player; Docker → AWS Fargate (ALB, WebSockets); Pages client pointed at server for MP mode while solo remains fully offline.

## Milestone 4 — "Beyond the Browser"
Tauri wrapper → Steam build; gamepad support; options/keybinding UI; Capacitor experiment for mobile w/ touch D-pad + tap-to-interact; performance/battery pass.
