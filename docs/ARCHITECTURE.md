# ARCHITECTURE.md — Cryptgrid: Vault of Shadows

## The one decision that matters: sim ⟂ render

The entire game is an **authoritative simulation** in `packages/sim` — pure TypeScript, zero dependencies on Three.js, React, the DOM, or wall-clock time. Clients (the Three.js game, tests, and later the Colyseus server) drive it identically:

```
                 ┌────────────────────────────┐
   commands ───▶ │  packages/sim              │ ───▶ state + events
 (MOVE, TURN,    │  tick(state, cmds, dt=1)   │      (ItemPickedUp,
  INTERACT,      │  deterministic, seeded RNG │       DoorOpened,
  CAST_RUNE...)  └────────────────────────────┘       SpellCast...)
```

- **Single-player (now):** `apps/game` instantiates the sim locally, feeds it commands from keyboard/mouse, renders the resulting state, and animates off emitted events.
- **Multiplayer (Milestone 3):** the *same package* runs inside a Colyseus room on a Node server (Docker → AWS Fargate). Clients send the same command objects over WebSocket; server ticks; state syncs back. Client-side, movement tweens become client prediction. Nothing in the sim changes.

### Sim rules (enforced ruthlessly)

1. No `three`, no DOM, no `window`, no `fetch` imports. (Add an ESLint `no-restricted-imports` rule for the package.)
2. No `Date.now()` / `performance.now()`. Time = integer **tick** counter. Fixed tick rate: **10 ticks/sec**. The render loop runs at 60fps and interpolates; it accumulates real time and calls `tick()` at 10Hz.
3. All randomness via injected seeded PRNG (mulberry32 is fine): `createRng(seed)`.
4. `GameState` is a plain serializable object (JSON round-trippable). No classes holding closures in state.
5. Sim communicates outward via **events** returned from `tick()` — the renderer never diffs state to guess what happened.
6. Commands are plain objects: `{ type: 'MOVE', dir: 'forward' }`, `{ type: 'INTERACT', targetId }`, `{ type: 'CAST_RUNE', casterId, rune }`, etc. In MP these become wire messages verbatim.

### Core state sketch (starting point, evolve as needed)

```ts
interface GameState {
  tick: number;
  levelId: string;
  level: LevelRuntime;            // parsed level + mutable feature/door/item state
  party: {
    x: number; z: number; facing: Facing;   // one tile, shared by the party
    moveCooldownUntil: number;              // tick
    members: (Character | null)[];          // length 4
    inventory: ItemInstance[];              // shared list (M0)
    runeBuffer: RuneId[];                   // spell being composed
  };
  projectiles: Projectile[];
  rngState: number;
}

interface Character {
  id: string; name: string;
  hp: Stat; mana: Stat; stamina: Stat; food: Stat; water: Stat;  // {cur, max}
}
```

This sketch shows only the vitals baseline. The full character shape — attributes, classes, weapon skills, resistances, spell mastery, and why Food/Water above becomes one merged Hunger/Thirst field — is designed in STATS.md and lands starting M0.6.

## Monorepo (pnpm workspaces)

| Package | Role | Key deps |
|---|---|---|
| `packages/sim` | Game rules, state, commands, level runtime, spell resolution | none (dev: vitest) |
| `apps/game` | Three.js renderer, input mapping, HUD (DOM overlay), audio | three, vite |
| `apps/editor` | 2D grid level editor, exports/imports level JSON | react, vite |
| `apps/server` | Colyseus room hosting the sim — **Milestone 3 only** | colyseus |
| `levels/` | Level JSON (see LEVELS.md) — shared data, not a package | — |
| `assets/` | Textures, sprites, rune glyphs (see ASSETS.md) | — |

TS project references or a shared `tsconfig.base.json`; `packages/sim` builds to ESM consumed by both apps.

## Rendering approach (apps/game)

- **Geometry from data, nothing hand-placed.** On level load, walk the grid and build **InstancedMesh** sets: wall faces, floor tiles, ceiling tiles. A wall face is a unit quad instanced with a transform; a 32×32 level is a few thousand instances — trivial.
- **Tile scale:** 1 tile = 3×3 world units, ceiling at 3. Camera FOV ~75°, positioned at (tileCenter, 1.6, tileCenter).
- **Textures:** 512×512 tileable PNGs from `assets/textures/` (see ASSETS.md), NearestFilter *off* — we want "clean retro," not pixel soup. One material per surface type; variants (secret-switch brick, alcove frame) are separate textures/materials on their specific instances.
- **Lighting:** ambient low + a point light attached to the camera (torch), warm color, distance falloff, subtle flicker (sin noise on intensity). Fog matched to background color sells the dungeon depth cheaply. No shadows in M0.
- **Items:** flat `THREE.Mesh` quads (`PlaneGeometry` rotated flat, `MeshStandardMaterial`) from `assets/items/`, lying on the floor/shelf plane rather than billboarded (M0.11) — a camera-facing sprite always rotates to face the viewer on every axis and can never read as resting on a surface no matter how well-shaded the art is; a flat quad gets correct perspective foreshortening from any angle for free, the same way the floor texture already does.
- **Wall features:** thin decorated quads floated 1cm off the wall face (switches, inscriptions) or recessed box cutouts (alcoves — darkened inset quad + item quad resting on the shelf's own local plane, same flat-mesh treatment as floor items).
- **Doors:** animated sliding mesh between tiles, driven by door state + `DoorOpened/Closing` events.
- **HUD is DOM, not WebGL.** Vitals bars, inventory panel, rune panel = an HTML/CSS overlay (plain TS + CSS is fine; no React in the game app for M0). Faster to build, accessible, trivially styleable.
- **Render loop:** `requestAnimationFrame`; accumulate dt → sim ticks at 10Hz; visual positions tween toward sim positions (move 200ms, turn 150ms, ease-out); input buffered (depth 1) while tweening.
- **Picking:** two raycast paths against the same interactable meshes (each tagged `userData.entityId`/`entityKind`, mapping back to sim entities) — a discrete one on click/`F` resolving to `PICKUP`/`INTERACT`/`STOW` depending on what was hit (`interactionInput.ts`), and a continuous per-frame one (M0.11, `hoverHighlighter.ts`) driving hover-only visual cues (light-blue glow on an in-pickup-range item, light-yellow tint on a secret switch) with no sim round-trip.

## Level pipeline

`apps/editor` and hand-editing both produce level JSON (LEVELS.md is the contract). `apps/game` fetches from `levels/` at runtime — no build step. Dev level: `levels/vault01.json`, designed to exercise every M0 feature (see ROADMAP).

## Multiplayer plan (recorded now, built in M3)

- Colyseus room = one dungeon instance; server ticks the sim at 10Hz; Colyseus schema mirrors `GameState` (or `patchRate` full-state JSON to start — state is tiny).
- Party model for MP: each player controls one character; the party still shares a tile initially (true co-op DM style) — separating players onto their own tiles is a design fork to decide then, and nothing in the sim's `party` shape prevents refactoring to `players[]` since all mutation goes through commands.
- Hosting: Docker image → ECS Fargate behind an ALB (WebSocket-friendly), or a single small EC2 to start. You know this terrain.
- Client prediction for your own movement; everything else server-authoritative. 10Hz + tiny state = comfortable.

## CI/CD

- `ci.yml`: pnpm install → typecheck → vitest → build → Playwright smoke (launch built game, wait for `data-ready="true"` attr set after first render, screenshot artifact, fail on console errors).
- `deploy.yml`: on `main`, build `apps/game` (base path `/cryptgrid/`) and `apps/editor` (`/cryptgrid/editor/`) → GitHub Pages. (S3+CloudFront is the graduation path; Pages is zero-config today.)

## Decision log (ADR-lite)

| # | Decision | Why |
|---|---|---|
| 1 | Web (Three.js+TS) over Unity | Fastest AI-iteration loop; editor & MP are web-native; Steam later via Tauri/Electron wrapper (proven by Vampire Survivors) |
| 2 | Pure-TS authoritative sim | Makes MP a transport swap; makes game rules unit-testable |
| 3 | 10Hz sim tick / 60fps render | Real-time feel with grid semantics; MP-friendly bandwidth |
| 4 | DOM HUD | Speed, styling, a11y; WebGL UI is wasted effort here |
| 5 | Level editor as separate web app | Best-in-class editor DX regardless of engine |
| 6 | GitHub Pages first, AWS later | Ship today; Fargate enters with the server in M3 |
