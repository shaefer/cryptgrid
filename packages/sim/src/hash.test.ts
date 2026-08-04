import { describe, expect, it } from "vitest";
import { cellHash, wallVariantIndex } from "./hash";

describe("cellHash", () => {
  it("returns the same result on repeated calls for the same cell", () => {
    for (const [x, z] of [
      [0, 0],
      [3, 7],
      [15, 15],
      [128, 4],
    ]) {
      expect(cellHash(x!, z!)).toBe(cellHash(x!, z!));
    }
  });

  it("distinguishes neighboring cells (a wall block never inherits its neighbor's stone)", () => {
    const base = cellHash(5, 5);
    expect(cellHash(6, 5)).not.toBe(base);
    expect(cellHash(5, 6)).not.toBe(base);
    expect(cellHash(4, 5)).not.toBe(base);
  });

  it("is not symmetric in x/z — (a,b) and (b,a) hash independently", () => {
    expect(cellHash(2, 9)).not.toBe(cellHash(9, 2));
  });
});

describe("wallVariantIndex", () => {
  it("always lands within [0, count)", () => {
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const index = wallVariantIndex(x, z, 3);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(3);
      }
    }
  });

  it("actually uses all 3 variants across a level-sized grid", () => {
    const seen = new Set<number>();
    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        seen.add(wallVariantIndex(x, z, 3));
      }
    }
    expect(seen.size).toBe(3);
  });

  it("tolerates count 0 without dividing by zero", () => {
    expect(wallVariantIndex(1, 1, 0)).toBe(0);
  });
});
