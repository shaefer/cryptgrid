import { describe, expect, it } from "vitest";
import { HUNGER_MAX, HUNGER_OVERFEED_MAX } from "../tuning";
import { createHungerThirst, hungerStatus, type HungerThirst } from "./vitals";

function bar(cur: number): HungerThirst {
  return { cur, max: 100, overfeedMax: 150 };
}

describe("createHungerThirst", () => {
  it("starts full, matching the tuning constants", () => {
    const hungerThirst = createHungerThirst();
    expect(hungerThirst.cur).toBe(HUNGER_MAX);
    expect(hungerThirst.max).toBe(HUNGER_MAX);
    expect(hungerThirst.overfeedMax).toBe(HUNGER_OVERFEED_MAX);
  });
});

describe("hungerStatus", () => {
  // Breakpoints from docs/STATS.md: Gorged 100-150%, Well-Fed 75-100%,
  // Satisfied 40-75%, Hungry 15-40%, Ravenous 5-15%, Starving 0-5%.
  it("classifies the overfeed range and exact 100% as Gorged", () => {
    expect(hungerStatus(bar(150))).toBe("gorged");
    expect(hungerStatus(bar(120))).toBe("gorged");
    expect(hungerStatus(bar(100))).toBe("gorged");
  });

  it("classifies 75-99% as Well-Fed", () => {
    expect(hungerStatus(bar(99))).toBe("wellFed");
    expect(hungerStatus(bar(75))).toBe("wellFed");
  });

  it("classifies 40-74% as Satisfied", () => {
    expect(hungerStatus(bar(74))).toBe("satisfied");
    expect(hungerStatus(bar(40))).toBe("satisfied");
  });

  it("classifies 15-39% as Hungry", () => {
    expect(hungerStatus(bar(39))).toBe("hungry");
    expect(hungerStatus(bar(15))).toBe("hungry");
  });

  it("classifies 5-14% as Ravenous", () => {
    expect(hungerStatus(bar(14))).toBe("ravenous");
    expect(hungerStatus(bar(5))).toBe("ravenous");
  });

  it("classifies below 5% (including 0) as Starving", () => {
    expect(hungerStatus(bar(4))).toBe("starving");
    expect(hungerStatus(bar(0))).toBe("starving");
  });
});
