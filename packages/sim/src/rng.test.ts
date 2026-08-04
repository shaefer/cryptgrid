import { describe, expect, it } from "vitest";
import { createRng } from "./rng";

describe("createRng", () => {
  it("is deterministic for a given seed", () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a.next(), a.next(), a.next()]).toEqual([b.next(), b.next(), b.next()]);
  });

  it("produces values in [0, 1)", () => {
    const rng = createRng(7);
    for (let i = 0; i < 200; i++) {
      const v = rng.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds diverge", () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });

  it("getState allows resuming an equivalent sequence", () => {
    const rng = createRng(99);
    rng.next();
    rng.next();
    const resumed = createRng(rng.getState());

    const original = createRng(99);
    original.next();
    original.next();

    expect(resumed.next()).toBe(original.next());
  });
});
