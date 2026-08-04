import { describe, expect, it } from "vitest";
import { CLASS_IDS, createInitialClassProgress } from "./classes";

describe("createInitialClassProgress", () => {
  it("creates all six classes at level 0 with no exp", () => {
    const progress = createInitialClassProgress();
    expect(Object.keys(progress).sort()).toEqual([...CLASS_IDS].sort());
    for (const id of CLASS_IDS) {
      expect(progress[id].level).toBe(0);
      expect(progress[id].exp).toBe(0);
    }
  });

  it("reveals Fighter, Ranger, Wizard, and Priest from the start", () => {
    const progress = createInitialClassProgress();
    expect(progress.fighter.revealed).toBe(true);
    expect(progress.ranger.revealed).toBe(true);
    expect(progress.wizard.revealed).toBe(true);
    expect(progress.priest.revealed).toBe(true);
  });

  it("keeps Rogue and Bard hidden until their reveal triggers exist (M1/M2)", () => {
    const progress = createInitialClassProgress();
    expect(progress.rogue.revealed).toBe(false);
    expect(progress.bard.revealed).toBe(false);
  });
});
