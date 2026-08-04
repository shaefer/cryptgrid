import { describe, expect, it } from "vitest";
import {
  CARRY_BASE_CAPACITY,
  CARRY_CAPACITY_PER_STR,
  carryCapacity,
  decayPerTick,
  expToNextLevel,
  masteryBonus,
  MAX_MASTERY_BONUS,
} from "./tuning";

describe("expToNextLevel", () => {
  it("costs more each level (super-linear), never less", () => {
    let previous = 0;
    for (let level = 1; level <= 30; level++) {
      const cost = expToNextLevel(level);
      expect(cost).toBeGreaterThan(previous);
      previous = cost;
    }
  });

  it("is not exponential — growth rate itself doesn't accelerate without bound", () => {
    // A power curve's *relative* step size shrinks as level grows; a true
    // exponential's wouldn't. Compare the ratio of consecutive costs late
    // in the curve to early in the curve — it should shrink, not grow.
    const earlyRatio = expToNextLevel(3) / expToNextLevel(2);
    const lateRatio = expToNextLevel(30) / expToNextLevel(29);
    expect(lateRatio).toBeLessThan(earlyRatio);
  });
});

describe("carryCapacity", () => {
  it("matches the documented formula", () => {
    expect(carryCapacity(0)).toBe(CARRY_BASE_CAPACITY);
    expect(carryCapacity(8)).toBe(CARRY_BASE_CAPACITY + 8 * CARRY_CAPACITY_PER_STR);
  });

  it("increases with STR", () => {
    expect(carryCapacity(10)).toBeGreaterThan(carryCapacity(5));
  });
});

describe("decayPerTick", () => {
  it("orders Ravenousness tiers correctly: brumal < standard < gluttonous < insatiable", () => {
    expect(decayPerTick("brumal")).toBeLessThan(decayPerTick("standard"));
    expect(decayPerTick("standard")).toBeLessThan(decayPerTick("gluttonous"));
    expect(decayPerTick("gluttonous")).toBeLessThan(decayPerTick("insatiable"));
  });
});

describe("masteryBonus", () => {
  it("grows with use but stays under the cap", () => {
    let previous = 0;
    for (const uses of [1, 5, 15, 30, 100]) {
      const bonus = masteryBonus(uses);
      expect(bonus).toBeGreaterThan(previous);
      expect(bonus).toBeLessThan(MAX_MASTERY_BONUS);
      previous = bonus;
    }
  });

  it("is zero with no uses", () => {
    expect(masteryBonus(0)).toBe(0);
  });
});
