# GAME_DESIGN.md — Cryptgrid: Vault of Shadows

## Vision

A first-person, **real-time**, grid-based dungeon crawler. You lead a party of adventurers through torch-lit stone vaults one tile at a time: pressing hidden switches, looting alcoves, rationing food and water, and weaving spells from sequences of runes. Dungeon Master's tension and tactility, modernized: instant loading, smooth 60fps movement tweens, playable in a browser tab, and eventually with friends.

**Tone:** classic dark fantasy. Cold stone, old iron, guttering torches, forgotten names carved into walls. Grim but adventurous, not horror.

## Pillars

1. **The grid is sacred.** All positions are discrete tiles; all facings are N/E/S/W. Movement *animates* smoothly but *resolves* discretely. Every mechanic (traps, switches, projectiles, monster AI later) reasons in tiles.
2. **Real-time, not turn-based.** The dungeon doesn't wait. Vitals decay, projectiles fly, and (later) monsters advance while you fumble your runes. Cooldowns, not turns.
3. **Tactile secrets.** Walls are interactive surfaces: switches, loose stones, alcoves, levers, inscriptions. Clicking the world is how you touch it. If a wall looks slightly different, it probably *is*.
4. **Spellcasting is a language.** Spells are composed from rune sequences (see SPELLS.md). Casting is a skill the *player* learns, not just the character.
5. **Multiplayer-shaped from day one.** One authoritative simulation; clients send commands. Solo play is "multiplayer with one client, locally."

## The party

- Up to **4 characters** in a 2×2 formation (front rank / back rank) occupying **one tile** together. Milestone 0 ships with 1 pre-made character; the data model supports 4 from the start.
- Each character has four vitals, displayed as bars:
  - **HP** — reaches 0 → unconscious (death/resurrection design deferred).
  - **Mana** — spent per rune while composing spells; regenerates slowly.
  - **Stamina** — drained by melee attacks and (lightly) by movement; regenerates when idle; at 0, actions slow.
  - **Hunger/Thirst** — one merged bar; food and water items both restore it, each with a small distinct bonus. Decays in real time; at 0, HP begins to drain. This is the classic DM survival pressure — keep decay *slow* (a full bar lasts ~20+ minutes of play) so it's a planning concern, not a nag.
- Regeneration ticks are computed in the sim at the fixed tick rate; resting (later milestone) accelerates it.
- Underneath those four bars is a much deeper character system — six attributes, six usage-leveled classes (two hidden until discovered), weapon proficiencies, resistances, per-spell mastery — that the player mostly *doesn't* see directly. Full design: STATS.md.

## Movement & camera

- Input: `W` forward, `S` back, `A`/`D` strafe, `Q`/`E` turn 90°. Arrow keys as alternates (Up/Down move, Left/Right turn).
- Camera at eye height (~1.6 units in a 3-unit-wide, 3-unit-tall corridor... final proportions per ARCHITECTURE.md render constants; DM corridors feel *tight*).
- Move tween ≈ 200ms, turn tween ≈ 150ms, slight ease-out. Inputs during a tween are **buffered** (queue depth 1) so held-key movement chains smoothly — this buffered-chaining feel is 80% of what makes Grimrock feel good. Bumping a wall plays a nudge animation + thud.
- Movement has a per-tile cooldown in the sim (the tween duration is the visual mirror of it).

## Interactions

- **Mouse raycast click** on world surfaces is the universal "touch" verb; `F` interacts with whatever is centered ahead.
- **Floor items:** rendered as camera-facing sprites (DM-style) lying on tiles; click to pick up into a party inventory (Milestone 0: shared party inventory list; per-character paper-doll inventory is a later milestone).
- **Alcoves:** recessed wall niches that hold items; click item to take, click alcove with item selected to place (placing can trigger puzzles later).
- **Switches & levers:** wall features that toggle targets by id — doors, secret doors, (later) pits and teleporters. **Secret switches** are visually subtle variants (a slightly displaced brick) — same mechanic, sneakier texture.
- **Doors:** portcullis/wooden slab that slides up/down over ~0.6s; blocks movement while closed. **Secret doors** look like plain wall until triggered, then grind sideways/up.
- **Wall inscriptions:** clickable flavor text (free content, great for hinting puzzles).

## Combat (design intent — implemented post-M0)

Real-time: click a character's weapon hand to attack the tile ahead (front rank melee, back rank reach/thrown/spells), per-hand cooldown timers, monsters occupy tiles and move on the same grid. The classic "combat waltz" (strafe-around-the-monster) is an embraced skill, not an exploit. Documented here so nothing in M0 forecloses it.

## What "done" looks like today (Milestone 0 summary)

Walk a textured 3D vault at 60fps; pick up items from floor and alcoves into inventory; find a secret switch that opens a secret door; watch vitals bars live their lives; cast Light and Firebolt by clicking runes. Full ordered task list: ROADMAP.md.
