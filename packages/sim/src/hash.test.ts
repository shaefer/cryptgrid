import { describe, expect, it } from "vitest";
import {
  autoWallVariant,
  BASE_WALL_VARIANT_IDS,
  cellHash,
  stringHash,
  TRANSITION_WALL_VARIANT_IDS,
  WALL_VARIANT_IDS,
  wallVariantIndex,
} from "./hash";

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

describe("BASE_WALL_VARIANT_IDS / TRANSITION_WALL_VARIANT_IDS / WALL_VARIANT_IDS", () => {
  it("has exactly 3 base looks and 3 pairwise transitions", () => {
    expect(BASE_WALL_VARIANT_IDS).toHaveLength(3);
    expect(TRANSITION_WALL_VARIANT_IDS).toHaveLength(3);
  });

  it("WALL_VARIANT_IDS is the concatenation of both, 6 total, no overlap", () => {
    expect(WALL_VARIANT_IDS).toHaveLength(6);
    expect(WALL_VARIANT_IDS).toEqual([...BASE_WALL_VARIANT_IDS, ...TRANSITION_WALL_VARIANT_IDS]);
    const overlap = BASE_WALL_VARIANT_IDS.filter((id) =>
      (TRANSITION_WALL_VARIANT_IDS as readonly string[]).includes(id),
    );
    expect(overlap).toEqual([]);
  });
});

describe("autoWallVariant", () => {
  it("always returns one of the 3 base variant ids — never a transition", () => {
    for (let x = 0; x < 10; x++) {
      for (let z = 0; z < 10; z++) {
        expect(BASE_WALL_VARIANT_IDS).toContain(autoWallVariant(x, z));
      }
    }
  });

  it("matches wallVariantIndex's pick by position in BASE_WALL_VARIANT_IDS", () => {
    expect(autoWallVariant(5, 5)).toBe(BASE_WALL_VARIANT_IDS[wallVariantIndex(5, 5, 3)]);
  });
});

describe("stringHash", () => {
  it("returns the same result on repeated calls for the same string", () => {
    expect(stringHash("sw_hidden1")).toBe(stringHash("sw_hidden1"));
  });

  it("distinguishes different strings", () => {
    expect(stringHash("sw_hidden1")).not.toBe(stringHash("sw_hidden2"));
  });

  it("returns a non-negative integer", () => {
    const h = stringHash("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
  });

  it("handles the empty string without throwing", () => {
    expect(() => stringHash("")).not.toThrow();
  });
});
