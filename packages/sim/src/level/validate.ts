import { FACING_DELTA } from "../facing";
import { ITEM_REGISTRY } from "../items/registry";
import type { LevelJSON } from "./types";

export interface ValidationError {
  code: string;
  message: string;
}

/**
 * Loadable from editor, game, and tests (LEVELS.md "Validation"). Assumes the
 * input already matches the LevelJSON shape — this checks the semantic rules
 * (rectangularity, door/cell agreement, feature placement, id/target integrity).
 */
export function validateLevel(level: LevelJSON): ValidationError[] {
  const errors: ValidationError[] = [];
  const inBounds = (x: number, z: number): boolean =>
    x >= 0 && z >= 0 && x < level.width && z < level.height;
  const cellAt = (x: number, z: number): string | undefined => level.cells[z]?.[x];

  if (level.cells.length !== level.height) {
    errors.push({
      code: "cells-height",
      message: `cells has ${level.cells.length} rows, expected height ${level.height}`,
    });
  }
  level.cells.forEach((row, z) => {
    if (row.length !== level.width) {
      errors.push({
        code: "cells-width",
        message: `row ${z} has length ${row.length}, expected width ${level.width}`,
      });
    }
  });

  if (!inBounds(level.start.x, level.start.z)) {
    errors.push({
      code: "start-oob",
      message: `start (${level.start.x},${level.start.z}) is out of bounds`,
    });
  } else if (cellAt(level.start.x, level.start.z) !== ".") {
    errors.push({
      code: "start-not-floor",
      message: `start (${level.start.x},${level.start.z}) is not a floor cell`,
    });
  }

  const seenIds = new Set<string>();
  const claimId = (id: string, where: string): void => {
    if (seenIds.has(id)) {
      errors.push({ code: "duplicate-id", message: `id "${id}" used more than once (${where})` });
    }
    seenIds.add(id);
  };

  const doorIds = new Set<string>();
  for (const door of level.doors) {
    claimId(door.id, "doors");
    doorIds.add(door.id);
    const expectedChar = door.type === "portcullis" ? "D" : "S";
    if (!inBounds(door.x, door.z)) {
      errors.push({
        code: "door-oob",
        message: `door "${door.id}" at (${door.x},${door.z}) is out of bounds`,
      });
    } else if (cellAt(door.x, door.z) !== expectedChar) {
      errors.push({
        code: "door-cell-mismatch",
        message: `door "${door.id}" expects cell "${expectedChar}" at (${door.x},${door.z}), found "${cellAt(door.x, door.z)}"`,
      });
    }
  }

  level.cells.forEach((row, z) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === "D" || ch === "S") {
        const match = level.doors.some((d) => d.x === x && d.z === z);
        if (!match) {
          errors.push({
            code: "door-missing",
            message: `cell (${x},${z}) is "${ch}" but has no doors[] entry`,
          });
        }
      }
    }
  });

  for (const feature of level.wallFeatures) {
    claimId(feature.id, "wallFeatures");

    if (!inBounds(feature.x, feature.z)) {
      errors.push({
        code: "feature-oob",
        message: `feature "${feature.id}" at (${feature.x},${feature.z}) is out of bounds`,
      });
      continue;
    }

    const cell = cellAt(feature.x, feature.z);
    if (cell === "#" || cell === "X" || cell === undefined) {
      errors.push({
        code: "feature-on-wall",
        message: `feature "${feature.id}" is attached from inside a wall cell (${feature.x},${feature.z})`,
      });
    }

    const delta = FACING_DELTA[feature.face];
    const nx = feature.x + delta.dx;
    const nz = feature.z + delta.dz;
    const neighbor = cellAt(nx, nz);
    if (neighbor !== "#" && neighbor !== "X" && neighbor !== "D" && neighbor !== "S") {
      errors.push({
        code: "feature-face-no-wall",
        message: `feature "${feature.id}" face "${feature.face}" does not border a wall or door (neighbor (${nx},${nz}) is "${neighbor ?? "out of bounds"}")`,
      });
    }

    if (feature.type === "switch" || feature.type === "lever") {
      for (const targetId of feature.targets) {
        if (!doorIds.has(targetId)) {
          errors.push({
            code: "target-unresolved",
            message: `feature "${feature.id}" targets unknown door "${targetId}"`,
          });
        }
      }
    }

    if (feature.type === "alcove") {
      for (const item of feature.items) {
        claimId(item.id, `alcove ${feature.id}`);
        if (!(item.type in ITEM_REGISTRY)) {
          errors.push({
            code: "unknown-item-type",
            message: `alcove "${feature.id}" item "${item.id}" has unknown type "${item.type}"`,
          });
        }
      }
    }
  }

  const seenSlots = new Set<string>();
  for (const item of level.items) {
    claimId(item.id, "items");
    if (!inBounds(item.x, item.z)) {
      errors.push({
        code: "item-oob",
        message: `item "${item.id}" at (${item.x},${item.z}) is out of bounds`,
      });
    } else if (cellAt(item.x, item.z) !== ".") {
      errors.push({
        code: "item-not-floor",
        message: `item "${item.id}" at (${item.x},${item.z}) is not on a floor cell`,
      });
    }
    if (!(item.type in ITEM_REGISTRY)) {
      errors.push({
        code: "unknown-item-type",
        message: `item "${item.id}" has unknown type "${item.type}"`,
      });
    }

    const slotKey = `${item.x},${item.z},${item.slot ?? "center"}`;
    if (seenSlots.has(slotKey)) {
      errors.push({
        code: "item-slot-collision",
        message: `item "${item.id}" collides with another item at (${item.x},${item.z}) slot "${item.slot ?? "center"}"`,
      });
    }
    seenSlots.add(slotKey);
  }

  return errors;
}
