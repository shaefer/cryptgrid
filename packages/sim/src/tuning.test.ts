import { describe, expect, it } from "vitest";
import { ITEM_REGISTRY } from "./items/registry";
import { createPremadeCharacter } from "./state";
import {
  CARRY_BASE_CAPACITY,
  CARRY_CAPACITY_PER_STR,
  carryCapacity,
  decayPerTick,
  expToNextLevel,
  masteryBonus,
  MAX_MASTERY_BONUS,
  pickupDistance,
  PICKUP_RANGE_TILES,
  sharedCarryCapacity,
  totalWeight,
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

describe("totalWeight", () => {
  it("is zero for an empty list", () => {
    expect(totalWeight([])).toBe(0);
  });

  it("sums known item weights", () => {
    const items = [
      { id: "a", type: "bread" },
      { id: "b", type: "waterflask" },
    ];
    expect(totalWeight(items)).toBe(ITEM_REGISTRY.bread!.weight + ITEM_REGISTRY.waterflask!.weight);
  });

  it("treats an unknown item type as zero weight", () => {
    expect(totalWeight([{ id: "a", type: "not-a-real-item" }])).toBe(0);
  });
});

describe("sharedCarryCapacity", () => {
  it("sums capacity across every filled party slot", () => {
    const bram = createPremadeCharacter();
    const other = { ...createPremadeCharacter(), attributes: { ...bram.attributes, str: 10 } };
    expect(sharedCarryCapacity([bram, other, null, null])).toBe(
      carryCapacity(bram.attributes.str) + carryCapacity(other.attributes.str),
    );
  });

  it("ignores empty slots", () => {
    const bram = createPremadeCharacter();
    expect(sharedCarryCapacity([bram, null, null, null])).toBe(carryCapacity(bram.attributes.str));
  });

  it("is zero for an empty party", () => {
    expect(sharedCarryCapacity([null, null, null, null])).toBe(0);
  });
});

describe("pickupDistance / PICKUP_RANGE_TILES", () => {
  it("keeps every quadrant slot on the party's own tile within range", () => {
    for (const slot of ["ne", "se", "nw", "sw"] as const) {
      expect(pickupDistance(1, 1, 1, 1, slot)).toBeLessThan(PICKUP_RANGE_TILES);
    }
  });

  it("keeps the near-half quadrant slot of an adjacent tile within range", () => {
    expect(pickupDistance(1, 1, 2, 1, "nw")).toBeLessThan(PICKUP_RANGE_TILES);
  });

  it("puts the far-half quadrant slot of an adjacent tile out of range", () => {
    expect(pickupDistance(1, 1, 2, 1, "se")).toBeGreaterThan(PICKUP_RANGE_TILES);
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
