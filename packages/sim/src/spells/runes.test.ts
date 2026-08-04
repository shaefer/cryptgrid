import { describe, expect, it } from "vitest";
import { resolveSpell, SPELL_REGISTRY } from "./registry";
import {
  allowedTiersAt,
  POTENCY_MULTIPLIERS,
  RUNES,
  RUNES_BY_ID,
  runeCost,
  runesOfTier,
} from "./runes";

describe("rune data", () => {
  it("defines exactly 24 runes, 6 per tier", () => {
    expect(RUNES).toHaveLength(24);
    for (const tier of ["potency", "essence", "form", "aspect"] as const) {
      expect(runesOfTier(tier)).toHaveLength(6);
    }
  });

  it("has unique ids", () => {
    expect(new Set(RUNES.map((r) => r.id)).size).toBe(24);
  });

  it("orders potency multipliers ascending ×1..×12", () => {
    expect(POTENCY_MULTIPLIERS).toEqual([1, 2, 3, 5, 8, 12]);
  });
});

describe("runeCost", () => {
  it("matches SPELLS.md's worked example: Kor Ign Dart = (1+2+2)×2 = 10", () => {
    const total = runeCost("kor", "kor") + runeCost("ign", "kor") + runeCost("dart", "kor");
    expect(total).toBe(10);
  });

  it("scales every rune in the spell by the potency multiplier", () => {
    // Zeth (×12): essence costs 2×12.
    expect(runeCost("lume", "zeth")).toBe(24);
    // The potency rune's own cost is multiplied too.
    expect(runeCost("zeth", "zeth")).toBe(12);
  });
});

describe("allowedTiersAt — the grammar", () => {
  it("walks POTENCY → ESSENCE → FORM|ASPECT → ASPECT-after-FORM", () => {
    expect(allowedTiersAt([])).toEqual(["potency"]);
    expect(allowedTiersAt(["kor"])).toEqual(["essence"]);
    expect(allowedTiersAt(["kor", "ign"])).toEqual(["form", "aspect"]);
    expect(allowedTiersAt(["kor", "ign", "dart"])).toEqual(["aspect"]);
  });

  it("closes the buffer after an aspect or at length 4", () => {
    expect(allowedTiersAt(["kor", "ign", "sel"])).toEqual([]);
    expect(allowedTiersAt(["kor", "ign", "dart", "sel"])).toEqual([]);
  });
});

describe("resolveSpell", () => {
  it("resolves bare [P] Lume to Light and [P] Ign Dart to Firebolt", () => {
    expect(resolveSpell(["eth", "lume"])?.id).toBe("light");
    expect(resolveSpell(["mal", "ign", "dart"])?.id).toBe("firebolt");
  });

  it("ignores potency when matching — any potency finds the same spell", () => {
    expect(resolveSpell(["zeth", "lume"])?.id).toBe(resolveSpell(["eth", "lume"])?.id);
  });

  it("returns undefined for unknown sequences (the fizzle case)", () => {
    expect(resolveSpell(["kor", "krys", "dart"])).toBeUndefined(); // Frostbolt is M1
    expect(resolveSpell(["kor"])).toBeUndefined(); // potency alone is not a spell
  });

  it("an aspect with no registry entry of its own still resolves via its essence+form", () => {
    // Sel (self) isn't itself registered — it's a modifier on Firebolt, not a fizzle.
    expect(resolveSpell(["kor", "ign", "dart", "sel"])?.id).toBe("firebolt");
  });

  it("registry keys never include potency runes", () => {
    for (const key of Object.keys(SPELL_REGISTRY)) {
      for (const runeId of key.split("+")) {
        expect(RUNES_BY_ID[runeId]?.tier).not.toBe("potency");
      }
    }
  });
});
