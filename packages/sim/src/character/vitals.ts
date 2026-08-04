import { HUNGER_MAX, HUNGER_OVERFEED_MAX, HUNGER_STATUS_BREAKPOINTS } from "../tuning";

/**
 * Merged Hunger/Thirst bar (docs/STATS.md) — replaces the old separate
 * Food/Water stats. `cur` can exceed `max` while overfed, up to
 * `overfeedMax`; this breaks the `cur <= max` invariant every other `Stat`
 * consumer assumes, which is why it's a distinct type rather than a reused
 * `Stat`.
 */
export interface HungerThirst {
  cur: number;
  max: number;
  overfeedMax: number;
}

/** Hidden metabolism stat governing decay rate — never shown to the player. */
export type RavenousnessTier = "brumal" | "standard" | "gluttonous" | "insatiable";

/** Player-visible status label — derived purely from the bar value, never from Ravenousness. */
export type HungerStatus = "gorged" | "wellFed" | "satisfied" | "hungry" | "ravenous" | "starving";

export function createHungerThirst(): HungerThirst {
  return { cur: HUNGER_MAX, max: HUNGER_MAX, overfeedMax: HUNGER_OVERFEED_MAX };
}

/** Pure function of the bar value against docs/STATS.md's tier table. */
export function hungerStatus(bar: HungerThirst): HungerStatus {
  const fraction = bar.cur / bar.max;
  if (fraction >= HUNGER_STATUS_BREAKPOINTS.gorged) return "gorged";
  if (fraction >= HUNGER_STATUS_BREAKPOINTS.wellFed) return "wellFed";
  if (fraction >= HUNGER_STATUS_BREAKPOINTS.satisfied) return "satisfied";
  if (fraction >= HUNGER_STATUS_BREAKPOINTS.hungry) return "hungry";
  if (fraction >= HUNGER_STATUS_BREAKPOINTS.ravenous) return "ravenous";
  return "starving";
}
