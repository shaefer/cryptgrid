import type { Attributes } from "./character/attributes";
import { createInitialClassProgress, type ClassProgressMap } from "./character/classes";
import { createInitialResistances, type ResistanceMap } from "./character/resistances";
import { createInitialSpellMastery, type SpellMasteryMap } from "./character/spellMastery";
import { createHungerThirst, type HungerThirst, type RavenousnessTier } from "./character/vitals";
import { createInitialWeaponSkills, type WeaponSkillMap } from "./character/weaponSkills";
import type { Facing } from "./facing";
import type { LevelRuntime } from "./level/types";

export interface Stat {
  cur: number;
  max: number;
}

export interface ItemInstance {
  id: string;
  type: string;
}

/** Two independent hand slots (docs/ROADMAP.md M0.7) — a held item, not yet stowed or equipped. */
export type Hands = [ItemInstance | null, ItemInstance | null];

export interface Character {
  id: string;
  name: string;
  hp: Stat;
  mana: Stat;
  stamina: Stat;
  hungerThirst: HungerThirst;
  /** Hidden — governs Hunger/Thirst decay rate. Never rendered. */
  ravenousness: RavenousnessTier;
  attributes: Attributes;
  classes: ClassProgressMap;
  weaponSkills: WeaponSkillMap;
  resistances: ResistanceMap;
  spellMastery: SpellMasteryMap;
  hands: Hands;
}

export interface PartyState {
  x: number;
  z: number;
  facing: Facing;
  moveCooldownUntil: number;
  members: (Character | null)[];
  inventory: ItemInstance[];
  runeBuffer: string[];
  /** Tick until which the Light spell boosts the torch — 0 = never cast. Recasting refreshes (max wins). */
  lightBoostUntil: number;
}

/** A spell projectile in flight (Firebolt, M0.9) — advances 1 tile per PROJECTILE_TICKS_PER_TILE. */
export interface Projectile {
  id: number;
  kind: "firebolt";
  x: number;
  z: number;
  facing: Facing;
  potencyMultiplier: number;
  /** Damage carried to impact — unused until monsters exist (M1). */
  damage: number;
  lastMovedTick: number;
}

export interface GameState {
  tick: number;
  levelId: string;
  level: LevelRuntime;
  party: PartyState;
  projectiles: Projectile[];
  /** Monotonic id source for spawned entities — deterministic, never reused. */
  nextProjectileId: number;
  rngState: number;
  /** Multiplies Hunger/Thirst decay for dev/testing visibility — 1 in normal play. */
  devDecayMultiplier: number;
}

/**
 * The pre-made starting character (ROADMAP.md M0.6). A fighter-leaning
 * balanced sheet — first-pass numbers, tunable like everything else in
 * docs/STATS.md.
 */
export function createPremadeCharacter(): Character {
  return {
    id: "bram",
    name: "Bram of the Ninth Door",
    hp: { cur: 20, max: 20 },
    mana: { cur: 10, max: 10 },
    stamina: { cur: 15, max: 15 },
    hungerThirst: createHungerThirst(),
    ravenousness: "standard",
    attributes: { str: 8, dex: 6, cha: 5, vit: 7, wis: 4, int: 4 },
    classes: createInitialClassProgress(),
    weaponSkills: createInitialWeaponSkills(),
    resistances: createInitialResistances(),
    spellMastery: createInitialSpellMastery(),
    hands: [null, null],
  };
}

export interface CreateInitialStateOptions {
  /** Speeds up Hunger/Thirst decay for dev/testing — see ROADMAP.md M0.6 AC. */
  devDecayMultiplier?: number;
}

export function createInitialState(
  level: LevelRuntime,
  seed: number,
  options: CreateInitialStateOptions = {},
): GameState {
  return {
    tick: 0,
    levelId: level.id,
    level,
    party: {
      x: level.start.x,
      z: level.start.z,
      facing: level.start.facing,
      moveCooldownUntil: 0,
      members: [createPremadeCharacter(), null, null, null],
      inventory: [],
      runeBuffer: [],
      lightBoostUntil: 0,
    },
    projectiles: [],
    nextProjectileId: 1,
    rngState: seed >>> 0,
    devDecayMultiplier: options.devDecayMultiplier ?? 1,
  };
}
