# STATS.md — Attributes, Classes, Vitals & Progression

Dungeon Master's character-depth systems (usage-based multi-classing, hidden weapon proficiencies, food *and* water pressure) are genre heritage we're building on — same as the rune-grammar spellcasting in SPELLS.md. Every name, number, and curve below is ours; only the shape of the idea is inherited. Numbers start single-digit and climb past 100 by mid-game.

**Status:** design-complete, unimplemented. M0.6 ("Party & vitals," ROADMAP.md) is the first milestone to build any of this. This doc is the shared contract for that build-out the same way LEVELS.md is for level JSON — read it before touching `packages/sim/src/character/`.

## Tuning philosophy

Every formula below is a *first-pass placeholder*, not a locked number. The precedent is `apps/game/src/tuning.ts`: one file, one exported constant or function per concern, a comment explaining not just the value but *why*, meant to be edited live and re-tuned by feel. `packages/sim/src/tuning.ts` (new, M0.6) is that file for game-rules math — exp curves, decay rates, carry capacity. If a number here and a number in code ever disagree, the code wins; update this doc to match.

## Secrecy: two different mechanisms, not one

The game is single-player through at least M2 (multiplayer is M3). "Hidden" therefore means **the HUD doesn't render it**, not that the sim conceals it — the local client's `GameState` already contains the whole truth, the same way any single-player save file does. Real server-side data-hiding only becomes meaningful in M3, and isn't a concern now.

Two mechanisms cover everything below, chosen per-system, not one generic "reveal system":

1. **Classes** get a one-time, permanent reveal, flipped by a specific in-fiction trigger (Rogue: first successful lockpick; Bard: first instrument use). This is state that persists, so it's a real field: `revealed: boolean` on each class's progress record.
2. **Weapon skills, resistances, and spell mastery** have no persisted reveal state at all. They're hidden by HUD policy, full stop — the player sees flavor text at milestone thresholds ("the blade feels natural in your hand"), never a number, until an Identify/appraisal-style spell or item is used, which shows the current numbers for that look (mechanism and exact milestone TBD — earliest plausible home is M2, alongside Truesight's reveal-through-magic theme).

Class **level** (a plain number, e.g. "Fighter — Lv 3") is visible for the four starting classes, shown on-demand the way HP is. Class **exp** — progress toward the next level — is *not*: it's hidden by the same HUD-policy rule as weapon skills/resistances/mastery, no bar or number, until a reveal spell/item exists (mechanism/milestone TBD, same family as #2 above). Rogue/Bard stay fully invisible — level, exp, everything — until their reveal trigger fires.

## Vitals

HP, Mana, and Stamina are unchanged from the existing design (GAME_DESIGN.md) — same `Stat {cur, max}` shape, same regen-at-the-fixed-tick-rate model.

### Hunger/Thirst (merged)

Today's separate Food and Water bars merge into **one** Hunger/Thirst bar, fillable by either food or water items. This is a real change to GAME_DESIGN.md's original five-vitals framing (see the ROADMAP/GAME_DESIGN edits below) — four visible bars now, not five.

- Each item still has a `kind` (`"food" | "water"`) and restores the same underlying bar equally, but also carries a small, distinct secondary bonus by kind (e.g. water leaning toward a brief Stamina tick, food toward a brief HP tick) — exact bonuses are a flavor-design decision for M0.7, when consumption is actually implemented. M0.6 only needs the item registry's `ConsumableEffect` shape to support this split (see "Sim-side shape" below).
- **Overfeed**: the bar can be filled past 100%, shown as a second-colored overflow segment on the HUD. This breaks the invariant every other `Stat` consumer assumes (`cur <= max`) — Hunger/Thirst needs its own type, not a reused `Stat`:

  ```ts
  interface HungerThirst {
    cur: number;        // can exceed max while overfed, capped at overfeedMax
    max: number;         // baseline "full"
    overfeedMax: number; // hard ceiling for the overflow region
  }
  ```

### Ravenousness (hidden metabolism stat)

A hidden stat governing how fast Hunger/Thirst decays. Four tiers, not a continuous number — variance should be small day-to-day, but dungeon effects (traps, curses, blessings, spells) can temporarily shift a character to a different tier:

| Tier | Feel |
|---|---|
| Brumal | Dormant, low-energy metabolic state — decays slowly |
| Standard | Baseline |
| Gluttonous | Decays faster than baseline |
| Insatiable | Decays fastest |

First-pass formula (→ `packages/sim/src/tuning.ts`):

```ts
decayPerTick = BASE_DECAY_PER_TICK * RAVENOUSNESS_MULTIPLIER[tier]
// RAVENOUSNESS_MULTIPLIER: brumal 0.5, standard 1.0, gluttonous 1.5, insatiable 2.0
// BASE_DECAY_PER_TICK tuned so a full bar lasts ~20+ minutes at Standard,
// preserving GAME_DESIGN.md's existing "planning concern, not a nag" goal.
```

### Hunger/Thirst status tiers (player-visible)

The player sees the bar and this status label — never the Ravenousness tier or the raw decay rate:

| Tier | Status | HP / Mana Regen | Attribute Penalties | Health Drain |
|---|---|---|---|---|
| 1 | Gorged | High boost | None (minor speed penalty) | None |
| 2 | Well-Fed | Minor boost | None | None |
| 3 | Satisfied | Standard | None (baseline) | None |
| 4 | Hungry | Minor slowdown | Small STR / DEX | None |
| 5 | Ravenous | Stopped | Medium STR / DEX • small WIS / INT / CHA | Slow |
| 6 | Starving | Stopped | Large STR / DEX • medium WIS / INT / CHA | Fast |

First-pass tier breakpoints as % of `max` (tunable): Gorged 100–150% (the overfeed range) · Well-Fed 75–100% · Satisfied 40–75% · Hungry 15–40% · Ravenous 5–15% · Starving 0–5%.

**Important scoping note for M0.6**: the sim computes and stores the *tier* (a pure function of the bar value) and the HP/Mana regen effect (a direct extension of the existing "at 0 food, HP drains" AC). It does **not** compute an "effective" or "penalized" STR/DEX — nothing reads an attribute value yet in M0.6, so that formula would have no caller. The first milestone that actually consumes an attribute (M0.7's carry capacity) is where tier-based penalty application belongs.

## Primary attributes

| Attribute | Governs | Becomes consequential in |
|---|---|---|
| **STR** | Melee power/damage, carrying capacity | Carry capacity: M0.7. Damage: M1. |
| **DEX** | Attack/reload speed, dodge | M1 (combat) |
| **CHA** | Haggling, aggro/targeting weight, bard spell & music effectiveness | Aggro: M1. Bard: M2. Haggling: unscheduled (see "Deferred"). |
| **VIT** | Regen rate, HP gained per level | M0.6 (regen), M1 (HP-per-level matters once there's danger) |
| **WIS** | Priest spell power & mana | M1 (once Priest spells beyond Light/Firebolt exist and matter) |
| **INT** | Wizard spell power & mana | M1 (same as WIS) |

M0.6 stores base values for all six on every character. Nothing derives an "effective" value from them yet except where noted above.

## Classes & leveling

Every character can progress in **every** class simultaneously — there's no "pick a class," the same way Dungeon Master let any character swing a sword *and* cast spells and gain both kinds of experience. A class levels from *using* the skills it governs.

| Class | Governing stat(s) | Exp source | Visible from start? |
|---|---|---|---|
| Fighter | STR, VIT | Melee weapon use | Yes |
| Ranger | DEX | Ranged (bow) weapon use — **not** thrown | Yes |
| Wizard | INT | Wizard-essence spellcasting | Yes |
| Priest | WIS | Priest-essence spellcasting | Yes |
| Rogue | DEX, CHA | Thrown/light weapons, poison, lockpicking | **No** — revealed by first successful lockpick |
| Bard | CHA | Instruments, singing | **No** — revealed by first instrument use |

A successful use of a relevant skill or spell grants more exp than a failed one, but both grant *something* — missing a swing still teaches you something about swinging. First-pass exp curve (→ `tuning.ts`):

```ts
expToNextLevel(level) = round(BASE_EXP * level ** EXP_CURVE_EXPONENT)
// BASE_EXP = 20, EXP_CURVE_EXPONENT = 1.4 — super-linear (each level costs
// more than the last) but not exponential (no runaway acceleration, no
// functional cap). Illustrative curve: L1=20, L5=~171, L10=~502, L20=~1,327.

expGain(success, difficultyWeight) =
  ACTION_BASE_EXP * (success ? SUCCESS_MULT : FAIL_MULT) * difficultyWeight
// ACTION_BASE_EXP = 1, SUCCESS_MULT = 1.0, FAIL_MULT = 0.35.
// difficultyWeight comes from the item/spell being used (1.0 baseline,
// higher for tougher gear/spells) — a registry field, not hardcoded per-item.
```

**Roadmap dependency, resolved**: as originally scoped, Ranger had no exp source anywhere in the roadmap (M1's combat bullet only covers melee) and would have been permanently stuck at level 0. Fixed by adding ranged weapons to M1 (see ROADMAP.md edits below) — noting it here because it's the kind of gap this doc exists to catch.

## Weapon skills (hidden)

Independent of class — any character builds proficiency with any weapon type through use: **mace, axe, sword, spear, bow, thrown, shield**. Usage-based growth (same shape as class exp, separately tracked, smaller magnitude) unlocks weapon-specific special abilities at thresholds. Exact abilities are combat-design work for M1, not scoped here — this doc fixes the *shape* (seven independent hidden counters per character) so M1 has somewhere to hang mechanics without a data-model change.

## Armor tiers

Rules only, in M0.6 — *which combination of class levels qualifies a character for which armor tier*, not an equip system (that's M2's paper-doll inventory). Scope carefully worded: this system answers "what tier could you wear," never "what's currently worn." Exact tier/level tables are M2 content work.

## Elemental resistances (hidden)

Four elements: **fire, ice, poison, lightning**. Firebolt (M0.9) already deals fire damage and Frostbolt (M1) will deal ice, so resistance has real consequence as soon as something can be damaged by them — practically, M1, once monsters exist to be the other side of that exchange.

## Spell mastery

Every spell gets its own hidden usage counter: `{ uses: number; successes: number }`, keyed by spell id, starting **sparse** (`{}`, populated lazily on first cast — not pre-seeded, since the spell-id key space belongs to `spells/registry.ts`, which doesn't exist until M0.9). Heavy use of one spell should nudge its success chance up slightly over the level+stat baseline; a spell that's rarely cast stays near baseline even at the same nominal level. This is the direct fulfillment of SPELLS.md's existing deferred line: *"Character skill/fizzle-chance systems come later; M0 is deterministic."*

```ts
masteryBonus(uses) = MAX_MASTERY_BONUS * (1 - exp(-uses / MASTERY_HALF_LIFE))
// Diminishing returns, asymptotic to a small cap — MAX_MASTERY_BONUS and
// MASTERY_HALF_LIFE are placeholders for M1 tuning.
```

M0.6 only builds the counter shape and the increment (spell casts in M0.9 tick it up). The success-chance formula that *reads* mastery is M1 spell-resolution logic, living in `spells/`, not `character/`.

## Carrying capacity

STR-derived, lives in `tuning.ts`:

```ts
carryCapacity(str) = BASE_CAPACITY + str * CAPACITY_PER_STR
// BASE_CAPACITY = 20, CAPACITY_PER_STR = 2 (abstract weight units, defined
// by each item's weight field — added to items/registry.ts in M0.7).
```

Enforced starting M0.7, once items have weight and there's an inventory to check against.

## Charisma's three uses — deliberately split, not one bucket

Bundling all of CHA's uses as "later" would hide that they land in three genuinely different places:

- **Aggro/targeting weight** — natural fit alongside M1's monster AI (grid AI: patrol/chase/attack already needs a targeting rule; CHA-weighting it is a small addition, not a new milestone).
- **Bard spell/music effectiveness** — arrives with Bard's M2 reveal.
- **Haggling** — see "Deferred," below. Not scheduled.

## Deferred / explicitly unscheduled

**Vendor/haggling economy.** No milestone commitment. The earliest plausible home is M2 (it's already the equipment/economy-adjacent milestone, per "Truesight + subtle-secrets economy"), but this is flagged as exploratory, not a bullet — revisit once M2's scope is clearer. Recorded here so it isn't forgotten, not so it's promised.

**Exact armor tier/level tables, weapon-skill unlock abilities, hunger-status attribute-penalty magnitudes, Identify/appraisal mechanism.** All real design work, all deliberately left as "shape now, numbers later" — same posture as every tunable constant above.

## Sim-side shape (built starting M0.6)

New `packages/sim/src/character/` subfolder, mirroring the existing `level/` and `items/` topic folders (flat files, no subfolder `index.ts` — `packages/sim/src/index.ts` gets one new `export * from "./character/xxx"` line per file, matching its current pattern exactly):

| File | Contents |
|---|---|
| `attributes.ts` | STR/DEX/CHA/VIT/WIS/INT type only — no formulas (those live in `tuning.ts`) |
| `classes.ts` | `ClassId`, `ClassProgress { level, exp, revealed }`, class registry |
| `weaponSkills.ts` | `WeaponType`, per-type hidden progress (no `revealed` field — see Secrecy) |
| `resistances.ts` | `ElementType`, resistance block |
| `spellMastery.ts` | Sparse `Record<string, { uses, successes }>` shape only |
| `armor.ts` | Tier-qualification rules only |
| `vitals.ts` | *Only* the new `HungerThirst` type + Ravenousness tier + status-tier table — HP/Mana/Stamina stay in `state.ts` unchanged |

`packages/sim/src/tuning.ts` (new) holds every numeric knob above, mirroring `apps/game/src/tuning.ts`'s convention.

**Known M0.7 touch-point, flagged now so it isn't a surprise later:** `items/registry.ts`'s `ConsumableEffect { restores: "food" | "water"; amount: number }` no longer matches a merged bar. It'll need restructuring along the lines of `{ kind: "food" | "water"; amount: number; bonus?: {...} }` when M0.7 implements consumption — not built in M0.6.
