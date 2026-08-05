import { describe, expect, it } from "vitest";
import type { LevelJSON } from "./types";
import { validateLevel } from "./validate";

// Small 5x4 room, deliberately valid, mutated per-test to trigger one error at a time.
//   #####
//   #...#
//   #.D.#
//   #####
function baseLevel(): LevelJSON {
  return {
    formatVersion: 1,
    id: "test",
    name: "Test Room",
    width: 5,
    height: 4,
    cells: ["#####", "#...#", "#.D.#", "#####"],
    start: { x: 1, z: 1, facing: "E" },
    doors: [{ id: "d1", x: 2, z: 2, type: "portcullis", open: false }],
    wallFeatures: [{ id: "txt1", x: 3, z: 1, face: "N", type: "inscription", text: "hi" }],
    items: [{ id: "it1", type: "bread", x: 1, z: 2 }],
    triggers: [],
    spawns: [],
  };
}

describe("validateLevel", () => {
  it("accepts a well-formed level", () => {
    expect(validateLevel(baseLevel())).toEqual([]);
  });

  it("accepts the authored vault01 level", async () => {
    const { readFileSync } = await import("node:fs");
    const url = new URL("../../../../levels/vault01.json", import.meta.url);
    const json = JSON.parse(readFileSync(url, "utf-8")) as LevelJSON;
    expect(validateLevel(json)).toEqual([]);
  });

  it("catches a row whose length doesn't match width", () => {
    const level = baseLevel();
    level.cells[1] = "#..#";
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "cells-width")).toBe(true);
  });

  it("catches a start position that isn't on a floor cell", () => {
    const level = baseLevel();
    level.start = { x: 0, z: 1, facing: "E" };
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "start-not-floor")).toBe(true);
  });

  it("catches a door whose type doesn't match its cell character", () => {
    const level = baseLevel();
    level.doors[0]!.type = "secret"; // cell is 'D', secret doors expect 'S'
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "door-cell-mismatch")).toBe(true);
  });

  it("catches a wall feature whose face doesn't border a wall or door", () => {
    const level = baseLevel();
    level.wallFeatures[0] = { ...level.wallFeatures[0]!, face: "S" }; // neighbor (3,2) is floor
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "feature-face-no-wall")).toBe(true);
  });

  it("catches an item placed on a non-floor cell", () => {
    const level = baseLevel();
    level.items[0]!.x = 2;
    level.items[0]!.z = 2; // the door cell
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "item-not-floor")).toBe(true);
  });

  it("catches a duplicate id across doors/features/items", () => {
    const level = baseLevel();
    level.items.push({ id: "d1", type: "bread", x: 3, z: 1 }); // collides with door id
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "duplicate-id")).toBe(true);
  });

  it("catches a switch/lever target that doesn't resolve to a door", () => {
    const level = baseLevel();
    level.wallFeatures.push({
      id: "sw1",
      x: 3,
      z: 1,
      face: "N",
      type: "switch",
      targets: ["nope"],
      action: "toggle",
    });
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "target-unresolved")).toBe(true);
  });

  it("accepts a switch targeting an alcove id — even one defined after the switch", () => {
    const level = baseLevel();
    level.wallFeatures.push(
      {
        id: "sw1",
        x: 3,
        z: 1,
        face: "N",
        type: "switch",
        targets: ["alc1"],
        action: "toggle",
      },
      {
        id: "alc1",
        x: 1,
        z: 1,
        face: "W",
        type: "alcove",
        hidden: true,
        items: [],
      },
    );
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "target-unresolved")).toBe(false);
  });

  it("catches an item with an unknown type", () => {
    const level = baseLevel();
    level.items[0]!.type = "unobtainium";
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "unknown-item-type")).toBe(true);
  });

  it("catches two items sharing the same tile and slot", () => {
    const level = baseLevel();
    // it1 is already at (1,2) with no slot (defaults to "center").
    level.items.push({ id: "it2", type: "torch", x: 1, z: 2 });
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "item-slot-collision")).toBe(true);
  });

  it("allows two items on the same tile in different slots", () => {
    const level = baseLevel();
    level.items.push({ id: "it2", type: "torch", x: 1, z: 2, slot: "ne" });
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "item-slot-collision")).toBe(false);
  });

  it("accepts a wall texture override on an actual wall cell", () => {
    const level = baseLevel();
    level.wallOverrides = [{ x: 0, z: 0, variant: "thinbrick" }];
    expect(validateLevel(level)).toEqual([]);
  });

  it("catches a wall texture override on a non-wall cell", () => {
    const level = baseLevel();
    level.wallOverrides = [{ x: 1, z: 1, variant: "thinbrick" }]; // floor, not wall
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "wall-override-not-wall")).toBe(true);
  });

  it("accepts a transition wall variant as a valid override", () => {
    const level = baseLevel();
    level.wallOverrides = [{ x: 0, z: 0, variant: "stone-fieldstone" }];
    expect(validateLevel(level)).toEqual([]);
  });

  it("catches an unknown wall variant id", () => {
    const level = baseLevel();
    // @ts-expect-error deliberately malformed for the runtime check
    level.wallOverrides = [{ x: 0, z: 0, variant: "marble" }];
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "unknown-wall-variant")).toBe(true);
  });

  it("catches two overrides authored for the same cell", () => {
    const level = baseLevel();
    level.wallOverrides = [
      { x: 0, z: 0, variant: "thinbrick" },
      { x: 0, z: 0, variant: "fieldstone" },
    ];
    const errors = validateLevel(level);
    expect(errors.some((e) => e.code === "wall-override-duplicate")).toBe(true);
  });
});
