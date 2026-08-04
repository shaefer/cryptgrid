/**
 * Game-rules math — every constant worth arguing about, in one place.
 *
 * Mirrors apps/game/src/tuning.ts's convention (one file, one constant or
 * function per concern, comments explaining *why* not just what) but for sim
 * rules instead of render feel. Every number here is a first-pass placeholder
 * per docs/STATS.md — meant to be re-tuned by playtesting, not treated as
 * final. If this file and STATS.md ever disagree, this file wins; update the
 * doc to match.
 */

import type { RavenousnessTier } from "./character/vitals";
import { TICKS_PER_SECOND } from "./constants";

// --- Class leveling (docs/STATS.md "Classes & leveling") ---

/** Super-linear but not exponential: each level costs more, growth never runs away, no functional cap. */
export const EXP_CURVE_BASE = 20;
export const EXP_CURVE_EXPONENT = 1.4;

export function expToNextLevel(level: number): number {
  return Math.round(EXP_CURVE_BASE * Math.pow(Math.max(level, 1), EXP_CURVE_EXPONENT));
}

/** A successful use teaches more than a failed one, but both teach something. */
export const ACTION_BASE_EXP = 1;
export const EXP_SUCCESS_MULTIPLIER = 1.0;
export const EXP_FAILURE_MULTIPLIER = 0.35;

/** difficultyWeight comes from the item/spell being used (registry field), 1.0 = baseline. */
export function expGain(success: boolean, difficultyWeight: number): number {
  const mult = success ? EXP_SUCCESS_MULTIPLIER : EXP_FAILURE_MULTIPLIER;
  return ACTION_BASE_EXP * mult * difficultyWeight;
}

// --- Spell mastery (docs/STATS.md "Spell mastery") ---

/** Diminishing returns toward a small cap — heavy use of one spell nudges its success chance, doesn't dominate it. */
export const MAX_MASTERY_BONUS = 0.1;
export const MASTERY_HALF_LIFE_USES = 15;

export function masteryBonus(uses: number): number {
  return MAX_MASTERY_BONUS * (1 - Math.exp(-uses / MASTERY_HALF_LIFE_USES));
}

// --- Carrying capacity (docs/STATS.md "Carrying capacity") ---

export const CARRY_BASE_CAPACITY = 20;
export const CARRY_CAPACITY_PER_STR = 2;

/** Abstract weight units — defined per-item by a weight field added in M0.7. */
export function carryCapacity(str: number): number {
  return CARRY_BASE_CAPACITY + str * CARRY_CAPACITY_PER_STR;
}

// --- Hunger/Thirst decay (docs/STATS.md "Ravenousness") ---

/** Full bar lasts ~20 minutes at Standard tier — GAME_DESIGN.md's "planning concern, not a nag" goal. */
const HUNGER_FULL_MINUTES_AT_STANDARD = 20;
export const HUNGER_MAX = 100;
export const HUNGER_OVERFEED_MAX = 150;

export const BASE_DECAY_PER_TICK =
  HUNGER_MAX / (HUNGER_FULL_MINUTES_AT_STANDARD * 60 * TICKS_PER_SECOND);

export const RAVENOUSNESS_MULTIPLIER: Record<RavenousnessTier, number> = {
  brumal: 0.5,
  standard: 1.0,
  gluttonous: 1.5,
  insatiable: 2.0,
};

export function decayPerTick(tier: RavenousnessTier): number {
  return BASE_DECAY_PER_TICK * RAVENOUSNESS_MULTIPLIER[tier];
}

// --- Hunger/Thirst status tiers (docs/STATS.md table) ---
// Breakpoints as a fraction of `max`. Gorged is the overfeed range, >1.0.

export const HUNGER_STATUS_BREAKPOINTS = {
  gorged: 1.0,
  wellFed: 0.75,
  satisfied: 0.4,
  hungry: 0.15,
  ravenous: 0.05,
  starving: 0,
} as const;

// --- Vitals regen, modulated by hunger status (docs/STATS.md tier table) ---

export const HP_REGEN_PER_TICK = 0.02;
export const MANA_REGEN_PER_TICK = 0.03;
export const STAMINA_REGEN_PER_TICK = 0.05;

/** Gorged/Well-Fed boost regen, Hungry slows it, Ravenous/Starving stop it outright. */
export const REGEN_MULTIPLIER_BY_STATUS = {
  gorged: 2.0,
  wellFed: 1.25,
  satisfied: 1.0,
  hungry: 0.5,
  ravenous: 0,
  starving: 0,
} as const;

/** Ravenous drains slowly, Starving drains fast — both are "Health Drain" in the STATS.md table, not just 0. */
export const HP_DRAIN_PER_TICK_BY_STATUS = {
  gorged: 0,
  wellFed: 0,
  satisfied: 0,
  hungry: 0,
  ravenous: 0.05,
  starving: 0.15,
} as const;
