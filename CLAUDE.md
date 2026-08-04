# CLAUDE.md — Cryptgrid: Vault of Shadows

First-person, real-time, grid-based dungeon crawler in the tradition of Dungeon Master (1987) and Legend of Grimrock. Web-native: Three.js + TypeScript. Multiplayer-ready architecture from day one; multiplayer implemented later.

## Read these before writing code

1. `docs/ROADMAP.md` — what to build, in order, with acceptance criteria. Always work top-down through the current milestone.
2. `docs/ARCHITECTURE.md` — the sim/render split. This is the load-bearing decision of the whole project.
3. `docs/LEVELS.md` — level JSON format (shared contract between game, editor, and future server).
4. `docs/GAME_DESIGN.md`, `docs/SPELLS.md`, `docs/STATS.md`, `docs/ASSETS.md` — as needed per task.

## Stack

- **Language:** TypeScript, `strict: true` everywhere. No `any` without a `// why:` comment.
- **Monorepo:** pnpm workspaces.
- **Rendering:** Three.js (WebGL) in `apps/game`, built with Vite.
- **Editor:** React + Vite in `apps/editor` (2D grid painter emitting level JSON).
- **Sim:** `packages/sim` — pure TS game logic. THE RULE: no imports of `three`, no DOM, no `window`, no `Date.now()`. See ARCHITECTURE.md.
- **Tests:** Vitest for `packages/sim` (this is where correctness lives). One Playwright smoke test for `apps/game`.
- **CI/CD:** GitHub Actions — typecheck + test on every PR; deploy `apps/game` and `apps/editor` to GitHub Pages on merge to `main`.

## Commands

```bash
pnpm install
pnpm dev            # runs apps/game (Vite, hot reload)
pnpm dev:editor     # runs apps/editor
pnpm test           # vitest across workspace
pnpm typecheck      # tsc --noEmit across workspace
pnpm build          # production builds
pnpm smoke          # Playwright smoke test against built game
```

(If a command doesn't exist yet, creating it is part of Milestone 0.)

## Working agreements

- **Sim purity is non-negotiable.** Any game rule (movement, pickup, switch, spell, vitals decay) is implemented in `packages/sim` with a Vitest test, then rendered in `apps/game`. If you find yourself writing game logic inside a Three.js class, stop and move it.
- **Determinism:** sim uses tick counts, never wall-clock time; all randomness through the injected seeded RNG (`packages/sim/src/rng.ts`). This is what makes future multiplayer cheap.
- **Small vertical slices.** Prefer "switch opens door end-to-end" over "all switch types, unrendered."
- **Self-verify.** After render-affecting changes, run the Playwright smoke test (loads the game, waits for first level render, screenshots, fails on console errors). Look at the screenshot.
- **60fps budget.** Walls/floors/ceilings are instanced meshes. Don't create per-frame garbage in the render loop.
- **Assets:** only CC0 or generated-in-repo assets. Every file under `assets/` must be listed in `docs/ASSETS.md` with provenance. No Dungeon Master / Grimrock rune names, glyphs, art, or text — mechanics are inspired by them; expression is ours (see SPELLS.md).
- **Commits:** conventional-ish, present tense (`feat: wall switches toggle secret doors`). Keep `main` green.
- **Milestone discipline:** don't build ahead of the roadmap (no monsters, no netcode, no save system until their milestone) — but don't paint them out of the design either.

## Repo layout (target)

```
cryptgrid/
  CLAUDE.md
  docs/                  # design + architecture docs (source of truth)
  packages/sim/          # pure TS simulation (game rules, state, commands)
  apps/game/             # Three.js client
  apps/editor/           # React level editor
  apps/server/           # Colyseus server — Milestone 3, placeholder README only until then
  assets/                # generated textures, item sprites, rune glyphs (all CC0/ours)
  levels/                # level JSON files (vault01.json = the dev level)
  .github/workflows/     # ci.yml, deploy.yml
```
