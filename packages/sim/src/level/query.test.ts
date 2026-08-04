import { describe, expect, it } from "vitest";
import { autoWallVariant } from "../hash";
import { findItemAt, findItemById, resolveWallVariant } from "./query";
import type { LevelItem, LevelRuntime, WallOverride } from "./types";

function levelWithItems(items: LevelItem[]): LevelRuntime {
  return {
    id: "test",
    name: "Test Room",
    width: 5,
    height: 4,
    cells: ["#####", "#...#", "#...#", "#####"],
    start: { x: 1, z: 1, facing: "E" },
    doors: [],
    wallFeatures: [],
    items,
    wallOverrides: [],
  };
}

function levelWithWallOverrides(overrides: WallOverride[]): LevelRuntime {
  return { ...levelWithItems([]), wallOverrides: overrides };
}

describe("findItemAt", () => {
  it("returns undefined when nothing occupies that tile/slot", () => {
    const level = levelWithItems([]);
    expect(findItemAt(level, 2, 2, "center")).toBeUndefined();
  });

  it("treats a missing slot as center", () => {
    const item: LevelItem = { id: "itm_1", type: "bread", x: 2, z: 2 };
    const level = levelWithItems([item]);
    expect(findItemAt(level, 2, 2, "center")).toEqual(item);
  });

  it("distinguishes all 5 slots on the same tile", () => {
    const items: LevelItem[] = [
      { id: "itm_center", type: "bread", x: 2, z: 2 },
      { id: "itm_ne", type: "torch", x: 2, z: 2, slot: "ne" },
      { id: "itm_se", type: "scroll", x: 2, z: 2, slot: "se" },
      { id: "itm_nw", type: "ironkey", x: 2, z: 2, slot: "nw" },
      { id: "itm_sw", type: "waterflask", x: 2, z: 2, slot: "sw" },
    ];
    const level = levelWithItems(items);

    expect(findItemAt(level, 2, 2, "center")?.id).toBe("itm_center");
    expect(findItemAt(level, 2, 2, "ne")?.id).toBe("itm_ne");
    expect(findItemAt(level, 2, 2, "se")?.id).toBe("itm_se");
    expect(findItemAt(level, 2, 2, "nw")?.id).toBe("itm_nw");
    expect(findItemAt(level, 2, 2, "sw")?.id).toBe("itm_sw");
  });

  it("does not match an item on a different tile", () => {
    const item: LevelItem = { id: "itm_1", type: "bread", x: 2, z: 2 };
    const level = levelWithItems([item]);
    expect(findItemAt(level, 3, 2, "center")).toBeUndefined();
  });
});

describe("findItemById", () => {
  it("finds an item regardless of its slot", () => {
    const item: LevelItem = { id: "itm_1", type: "torch", x: 1, z: 1, slot: "sw" };
    const level = levelWithItems([item]);
    expect(findItemById(level, "itm_1")).toEqual(item);
  });

  it("returns undefined for an unknown id", () => {
    const level = levelWithItems([{ id: "itm_1", type: "torch", x: 1, z: 1 }]);
    expect(findItemById(level, "does-not-exist")).toBeUndefined();
  });
});

describe("resolveWallVariant", () => {
  it("falls back to the deterministic auto-pick with no override", () => {
    const level = levelWithWallOverrides([]);
    expect(resolveWallVariant(level, 0, 0)).toBe(autoWallVariant(0, 0));
  });

  it("an authored override at that exact cell wins over the auto-pick", () => {
    // Pick whichever variant the hash *wouldn't* have chosen, so the override is provably in effect.
    const auto = autoWallVariant(0, 0);
    const forced = auto === "hewn" ? "stone" : "hewn";
    const level = levelWithWallOverrides([{ x: 0, z: 0, variant: forced }]);
    expect(resolveWallVariant(level, 0, 0)).toBe(forced);
  });

  it("only applies to the cell it's authored for", () => {
    const level = levelWithWallOverrides([{ x: 0, z: 0, variant: "fieldstone" }]);
    expect(resolveWallVariant(level, 1, 0)).toBe(autoWallVariant(1, 0));
  });
});
