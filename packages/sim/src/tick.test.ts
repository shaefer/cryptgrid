import { beforeEach, describe, expect, it } from "vitest";
import type { RavenousnessTier } from "./character/vitals";
import type { Facing } from "./facing";
import { parseLevel } from "./level/parse";
import type { LevelItem, LevelJSON } from "./level/types";
import { createInitialState, type Character, type GameState } from "./state";
import { ACTION_COOLDOWN_TICKS, canAct, tick } from "./tick";
import { decayPerTick, HP_DRAIN_PER_TICK_BY_STATUS } from "./tuning";

// Same 5x4 room as validate.test.ts, plus a second door for open/closed checks.
//   #####
//   #...#
//   #.D.#
//   #####
function roomLevel(): LevelJSON {
  return {
    formatVersion: 1,
    id: "test",
    name: "Test Room",
    width: 5,
    height: 4,
    cells: ["#####", "#...#", "#.D.#", "#####"],
    start: { x: 1, z: 1, facing: "E" },
    doors: [{ id: "d1", x: 2, z: 2, type: "portcullis", open: false }],
    wallFeatures: [],
    items: [],
    triggers: [],
    spawns: [],
  };
}

function advance(state: GameState, ticks: number): GameState {
  let s = state;
  for (let i = 0; i < ticks; i++) {
    s = tick(s, []).state;
  }
  return s;
}

describe("tick — movement", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(parseLevel(roomLevel()), 1);
  });

  it("blocks moving into a wall", () => {
    // Party starts at (1,1) facing E; facing W walks straight into the west wall.
    state = { ...state, party: { ...state.party, facing: "W" } };
    const result = tick(state, [{ type: "MOVE", dir: "forward" }]);

    expect(result.state.party.x).toBe(1);
    expect(result.state.party.z).toBe(1);
    expect(result.events).toEqual([{ type: "PartyBumped", x: 0, z: 1, facing: "W" }]);
  });

  it("moves into open floor and emits PartyMoved", () => {
    const result = tick(state, [{ type: "MOVE", dir: "forward" }]);

    expect(result.state.party.x).toBe(2);
    expect(result.state.party.z).toBe(1);
    expect(result.events).toEqual([{ type: "PartyMoved", x: 2, z: 1, facing: "E" }]);
  });

  it("rejects a second move issued before the cooldown elapses", () => {
    const first = tick(state, [{ type: "MOVE", dir: "forward" }]);
    expect(first.state.party.x).toBe(2);

    const second = tick(first.state, [{ type: "MOVE", dir: "forward" }]);
    expect(second.state.party.x).toBe(2); // unchanged — rejected
    expect(second.events).toEqual([]);
  });

  it("allows the next move once the cooldown elapses", () => {
    const first = tick(state, [{ type: "MOVE", dir: "forward" }]);
    const ready = advance(first.state, ACTION_COOLDOWN_TICKS);
    const second = tick(ready, [{ type: "MOVE", dir: "forward" }]);

    expect(second.state.party.x).toBe(3);
  });

  it("blocks moving through a closed door", () => {
    // Party at (1,1) facing E, one step forward is floor (2,1); face S to line up with the door at (2,2).
    state = { ...state, party: { ...state.party, x: 2, z: 1, facing: "S" } };
    const result = tick(state, [{ type: "MOVE", dir: "forward" }]);

    expect(result.state.party.z).toBe(1);
    expect(result.events).toEqual([{ type: "PartyBumped", x: 2, z: 2, facing: "S" }]);
  });

  it("allows moving through an open door", () => {
    const opened = {
      ...state,
      party: { ...state.party, x: 2, z: 1, facing: "S" as Facing },
      level: { ...state.level, doors: state.level.doors.map((d) => ({ ...d, open: true })) },
    };
    const result = tick(opened, [{ type: "MOVE", dir: "forward" }]);

    expect(result.state.party.z).toBe(2);
    expect(result.events).toEqual([{ type: "PartyMoved", x: 2, z: 2, facing: "S" }]);
  });
});

describe("tick — turning", () => {
  it("cycles facing N → E → S → W → N, respecting cooldown between turns", () => {
    let state = createInitialState(parseLevel(roomLevel()), 1);
    state = { ...state, party: { ...state.party, facing: "N" } };

    const expected: Facing[] = ["E", "S", "W", "N"];
    for (const facing of expected) {
      const result = tick(state, [{ type: "TURN", dir: "right" }]);
      expect(result.state.party.facing).toBe(facing);
      expect(result.events).toEqual([{ type: "PartyTurned", facing }]);
      state = advance(result.state, ACTION_COOLDOWN_TICKS);
    }
  });

  it("rejects a second turn issued before the cooldown elapses", () => {
    let state = createInitialState(parseLevel(roomLevel()), 1);
    state = { ...state, party: { ...state.party, facing: "N" } };

    const first = tick(state, [{ type: "TURN", dir: "right" }]);
    expect(first.state.party.facing).toBe("E");

    const second = tick(first.state, [{ type: "TURN", dir: "right" }]);
    expect(second.state.party.facing).toBe("E"); // unchanged — rejected
    expect(second.events).toEqual([]);
  });
});

describe("canAct", () => {
  it("is true on a fresh state and false while the cooldown runs", () => {
    const state = createInitialState(parseLevel(roomLevel()), 1);
    expect(canAct(state)).toBe(true);

    const moved = tick(state, [{ type: "MOVE", dir: "forward" }]).state;
    expect(canAct(moved)).toBe(false);
  });

  it("gates a held key to exactly one action per cooldown, dropping none", () => {
    // Drives the sim the way the client does (issue only when canAct) and
    // asserts the steady cadence that makes held-key movement glide.
    let s = createInitialState(parseLevel(roomLevel()), 1);
    const TICKS = 20;
    let actions = 0;

    for (let i = 0; i < TICKS; i++) {
      const commands = canAct(s) ? ([{ type: "MOVE", dir: "forward" }] as const) : [];
      const result = tick(s, commands);
      if (result.events.length > 0) actions++;
      s = result.state;
    }

    expect(actions).toBe(TICKS / ACTION_COOLDOWN_TICKS);
  });

  it("agrees with whether the sim actually accepts a command", () => {
    const state = createInitialState(parseLevel(roomLevel()), 1);
    let s = tick(state, [{ type: "MOVE", dir: "forward" }]).state;

    // Walk forward through the cooldown; whenever canAct says yes, a command
    // must produce an event, and whenever it says no, it must produce none.
    for (let i = 0; i < 8; i++) {
      const expected = canAct(s);
      const result = tick(s, [{ type: "TURN", dir: "right" }]);
      expect(result.events.length > 0).toBe(expected);
      s = result.state;
    }
  });
});

function bram(state: GameState): Character {
  const member = state.party.members[0];
  if (!member) throw new Error("expected the pre-made character in party slot 0");
  return member;
}

function withCharacter(state: GameState, patch: Partial<Character>): GameState {
  return {
    ...state,
    party: { ...state.party, members: [{ ...bram(state), ...patch }, null, null, null] },
  };
}

function withHunger(
  state: GameState,
  cur: number,
  ravenousness: RavenousnessTier = "standard",
): GameState {
  const character = bram(state);
  return withCharacter(state, {
    hungerThirst: { ...character.hungerThirst, cur },
    ravenousness,
  });
}

function withLevelItems(state: GameState, items: LevelItem[]): GameState {
  return { ...state, level: { ...state.level, items } };
}

describe("tick — vitals", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(parseLevel(roomLevel()), 1);
  });

  it("spawns the pre-made character with Rogue and Bard hidden", () => {
    const character = bram(state);
    expect(character.classes.fighter.revealed).toBe(true);
    expect(character.classes.ranger.revealed).toBe(true);
    expect(character.classes.wizard.revealed).toBe(true);
    expect(character.classes.priest.revealed).toBe(true);
    expect(character.classes.rogue.revealed).toBe(false);
    expect(character.classes.bard.revealed).toBe(false);
  });

  it("decays Hunger/Thirst by one tick's worth", () => {
    state = withHunger(state, 100, "standard");
    const after = bram(tick(state, []).state).hungerThirst.cur;
    expect(after).toBeCloseTo(100 - decayPerTick("standard"), 6);
  });

  it("decays faster at higher Ravenousness tiers", () => {
    const standard = withHunger(state, 100, "standard");
    const insatiable = withHunger(state, 100, "insatiable");

    const standardAfter = bram(tick(standard, []).state).hungerThirst.cur;
    const insatiableAfter = bram(tick(insatiable, []).state).hungerThirst.cur;

    expect(insatiableAfter).toBeLessThan(standardAfter);
  });

  it("scales decay by devDecayMultiplier for dev/testing visibility", () => {
    let fast = createInitialState(parseLevel(roomLevel()), 1, { devDecayMultiplier: 100 });
    fast = withHunger(fast, 100, "standard");
    const after = bram(tick(fast, []).state).hungerThirst.cur;
    expect(100 - after).toBeCloseTo(decayPerTick("standard") * 100, 4);
  });

  it("never lets Hunger/Thirst decay below 0", () => {
    let fast = createInitialState(parseLevel(roomLevel()), 1, { devDecayMultiplier: 1_000_000 });
    fast = withHunger(fast, 0.5, "standard");
    const after = bram(tick(fast, []).state).hungerThirst.cur;
    expect(after).toBe(0);
  });

  it("drains HP slowly while Ravenous (5-15%)", () => {
    state = withHunger(state, 10, "standard");
    const before = bram(state).hp.cur;
    const after = bram(tick(state, []).state).hp.cur;
    expect(before - after).toBeCloseTo(HP_DRAIN_PER_TICK_BY_STATUS.ravenous, 6);
  });

  it("drains HP faster while Starving (<5%) than while Ravenous", () => {
    const ravenous = withHunger(state, 10, "standard");
    const starving = withHunger(state, 2, "standard");

    const ravenousDrain = bram(ravenous).hp.cur - bram(tick(ravenous, []).state).hp.cur;
    const starvingDrain = bram(starving).hp.cur - bram(tick(starving, []).state).hp.cur;

    expect(starvingDrain).toBeGreaterThan(ravenousDrain);
  });

  it("does not drain HP when Satisfied or better", () => {
    state = withHunger(state, 50, "standard"); // satisfied range
    const before = bram(state).hp.cur;
    const after = bram(tick(state, []).state).hp.cur;
    expect(after).toBe(before);
  });

  it("regenerates HP toward max when Well-Fed", () => {
    state = withCharacter(state, { hp: { cur: 10, max: 20 } });
    state = withHunger(state, 80, "standard"); // well-fed range
    const after = bram(tick(state, []).state).hp.cur;
    expect(after).toBeGreaterThan(10);
  });

  it("stops HP regen while Ravenous, even if HP is below max", () => {
    state = withCharacter(state, { hp: { cur: 10, max: 20 } });
    state = withHunger(state, 10, "standard"); // ravenous range
    // Ravenous both stops regen and drains — net effect is a decrease, never an increase.
    const before = bram(state).hp.cur;
    const after = bram(tick(state, []).state).hp.cur;
    expect(after).toBeLessThan(before);
  });
});

describe("tick — PICKUP", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(parseLevel(roomLevel()), 1);
  });

  it("moves a floor item into an empty hand and removes it from the level", () => {
    state = withLevelItems(state, [{ id: "itm_1", type: "bread", x: 1, z: 1 }]);
    const result = tick(state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_1" }]);

    const character = bram(result.state);
    expect(character.hands[0]).toEqual({ id: "itm_1", type: "bread" });
    expect(character.hands[1]).toBeNull();
    expect(result.state.level.items).toEqual([]);
    expect(result.events).toEqual([
      { type: "ItemPickedUp", characterId: "bram", itemId: "itm_1", hand: 0 },
    ]);
  });

  it("fills the second hand when the first is already occupied", () => {
    state = withLevelItems(state, [{ id: "itm_2", type: "torch", x: 1, z: 1 }]);
    state = withCharacter(state, { hands: [{ id: "itm_held", type: "shortsword" }, null] });

    const result = tick(state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_2" }]);
    const character = bram(result.state);
    expect(character.hands[0]).toEqual({ id: "itm_held", type: "shortsword" });
    expect(character.hands[1]).toEqual({ id: "itm_2", type: "torch" });
    expect(result.events).toEqual([
      { type: "ItemPickedUp", characterId: "bram", itemId: "itm_2", hand: 1 },
    ]);
  });

  it("rejects pickup when both hands are full, leaving the item on the floor", () => {
    state = withLevelItems(state, [{ id: "itm_3", type: "torch", x: 1, z: 1 }]);
    state = withCharacter(state, {
      hands: [
        { id: "h0", type: "shortsword" },
        { id: "h1", type: "scroll" },
      ],
    });

    const result = tick(state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_3" }]);
    expect(result.events).toEqual([
      { type: "PickupRejected", characterId: "bram", itemId: "itm_3", reason: "hands-full" },
    ]);
    expect(result.state.level.items).toHaveLength(1);
  });

  it("rejects pickup when the item isn't on the party's tile", () => {
    state = withLevelItems(state, [{ id: "itm_4", type: "torch", x: 3, z: 1 }]); // party is at (1,1)
    const result = tick(state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_4" }]);
    expect(result.events).toEqual([
      { type: "PickupRejected", characterId: "bram", itemId: "itm_4", reason: "not-here" },
    ]);
  });

  it("respects the movement cooldown, same gate as MOVE/TURN", () => {
    state = withLevelItems(state, [
      { id: "itm_5", type: "torch", x: 1, z: 1 },
      { id: "itm_6", type: "torch", x: 1, z: 1, slot: "ne" },
    ]);
    const first = tick(state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_5" }]);
    const second = tick(first.state, [{ type: "PICKUP", characterId: "bram", itemId: "itm_6" }]);

    // Still on cooldown from the first pickup — second is silently rejected.
    expect(second.events).toEqual([]);
    expect(bram(second.state).hands[1]).toBeNull();
  });
});

describe("tick — STOW", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(parseLevel(roomLevel()), 1);
  });

  it("moves a held item into the shared inventory", () => {
    state = withCharacter(state, { hands: [{ id: "itm_1", type: "bread" }, null] });
    const result = tick(state, [{ type: "STOW", characterId: "bram", hand: 0 }]);

    expect(bram(result.state).hands[0]).toBeNull();
    expect(result.state.party.inventory).toEqual([{ id: "itm_1", type: "bread" }]);
    expect(result.events).toEqual([
      { type: "ItemStowed", characterId: "bram", itemId: "itm_1", hand: 0 },
    ]);
  });

  it("has no cooldown — works immediately after a move used up the shared gate", () => {
    state = withCharacter(state, { hands: [{ id: "itm_1", type: "bread" }, null] });
    const moved = tick(state, [{ type: "MOVE", dir: "forward" }]).state;

    const result = tick(moved, [{ type: "STOW", characterId: "bram", hand: 0 }]);
    expect(bram(result.state).hands[0]).toBeNull();
    expect(result.events).toEqual([
      { type: "ItemStowed", characterId: "bram", itemId: "itm_1", hand: 0 },
    ]);
  });

  it("no-ops on an empty hand", () => {
    const result = tick(state, [{ type: "STOW", characterId: "bram", hand: 0 }]);
    expect(result.events).toEqual([]);
    expect(result.state.party.inventory).toEqual([]);
  });

  it("rejects stowing once the summed carry capacity would be exceeded", () => {
    // Bram's capacity is carryCapacity(str=8) = 20 + 8*2 = 36. Six shortswords
    // (weight 6 each) already sit exactly at capacity; one more tips it over.
    const heavyInventory = Array.from({ length: 6 }, (_, i) => ({
      id: `sword_${i}`,
      type: "shortsword",
    }));
    state = { ...state, party: { ...state.party, inventory: heavyInventory } };
    state = withCharacter(state, { hands: [{ id: "one_more", type: "shortsword" }, null] });

    const result = tick(state, [{ type: "STOW", characterId: "bram", hand: 0 }]);
    expect(result.events).toEqual([
      { type: "StowRejected", characterId: "bram", itemId: "one_more", reason: "over-capacity" },
    ]);
    expect(bram(result.state).hands[0]).toEqual({ id: "one_more", type: "shortsword" });
    expect(result.state.party.inventory).toHaveLength(6);
  });
});

describe("tick — CONSUME", () => {
  let state: GameState;

  beforeEach(() => {
    state = createInitialState(parseLevel(roomLevel()), 1);
  });

  // Every tick() call — including one that only carries a CONSUME command —
  // also runs the unconditional per-tick vitals pass (decay + status-driven
  // regen), so exact-equality math here would need to replicate that pass to
  // stay correct. Bounded assertions capture the real intent (the bonus is
  // genuinely applied, on top of at most a hair of same-tick decay/regen)
  // without re-implementing tick.ts's formulas inside the test.

  it("consumes a held food item: restores Hunger/Thirst and applies its HP bonus", () => {
    state = withHunger(state, 50);
    state = withCharacter(state, { hp: { cur: 10, max: 20 } });
    state = withCharacter(state, { hands: [{ id: "itm_bread", type: "bread" }, null] });

    const before = bram(state);
    const result = tick(state, [{ type: "CONSUME", characterId: "bram", itemId: "itm_bread" }]);
    const after = bram(result.state);

    // +30 from the item, minus at most one tick's worth of decay.
    expect(after.hungerThirst.cur).toBeGreaterThan(before.hungerThirst.cur + 29.9);
    expect(after.hungerThirst.cur).toBeLessThanOrEqual(before.hungerThirst.cur + 30);
    // +2 from the bonus, plus at most one tick's worth of regen.
    expect(after.hp.cur).toBeGreaterThanOrEqual(before.hp.cur + 2);
    expect(after.hp.cur).toBeLessThan(before.hp.cur + 2.1);
    expect(after.hands[0]).toBeNull();
    expect(result.events).toEqual([{ type: "ItemConsumed", characterId: "bram", itemId: "itm_bread" }]);
  });

  it("consumes a food/water item from the shared inventory when it isn't held", () => {
    state = withHunger(state, 50);
    state = withCharacter(state, { stamina: { cur: 5, max: 15 } });
    state = { ...state, party: { ...state.party, inventory: [{ id: "itm_flask", type: "waterflask" }] } };

    const before = bram(state);
    const result = tick(state, [{ type: "CONSUME", characterId: "bram", itemId: "itm_flask" }]);
    const after = bram(result.state);

    expect(after.hungerThirst.cur).toBeGreaterThan(before.hungerThirst.cur + 29.9);
    expect(after.hungerThirst.cur).toBeLessThanOrEqual(before.hungerThirst.cur + 30);
    expect(after.stamina.cur).toBeGreaterThanOrEqual(before.stamina.cur + 3);
    expect(after.stamina.cur).toBeLessThan(before.stamina.cur + 3.1);
    expect(result.state.party.inventory).toEqual([]);
    expect(result.events).toEqual([{ type: "ItemConsumed", characterId: "bram", itemId: "itm_flask" }]);
  });

  it("never lets Hunger/Thirst exceed overfeedMax", () => {
    state = withHunger(state, 140); // + bread's 30 would be 170 without clamping
    state = withCharacter(state, { hands: [{ id: "itm_bread", type: "bread" }, null] });

    const overfeedMax = bram(state).hungerThirst.overfeedMax;
    const result = tick(state, [{ type: "CONSUME", characterId: "bram", itemId: "itm_bread" }]);
    expect(bram(result.state).hungerThirst.cur).toBeLessThanOrEqual(overfeedMax);
    expect(bram(result.state).hungerThirst.cur).toBeGreaterThan(overfeedMax - 1);
  });

  it("rejects consuming a non-consumable item", () => {
    state = withCharacter(state, { hands: [{ id: "itm_sword", type: "shortsword" }, null] });
    const result = tick(state, [{ type: "CONSUME", characterId: "bram", itemId: "itm_sword" }]);

    expect(result.events).toEqual([
      { type: "ConsumeRejected", characterId: "bram", itemId: "itm_sword", reason: "not-consumable" },
    ]);
    expect(bram(result.state).hands[0]).toEqual({ id: "itm_sword", type: "shortsword" });
  });

  it("rejects consuming an item that isn't held or in the shared inventory", () => {
    const result = tick(state, [{ type: "CONSUME", characterId: "bram", itemId: "does-not-exist" }]);
    expect(result.events).toEqual([
      { type: "ConsumeRejected", characterId: "bram", itemId: "does-not-exist", reason: "not-found" },
    ]);
  });

  it("has no cooldown — works immediately after a move used up the shared gate", () => {
    state = withCharacter(state, { hands: [{ id: "itm_bread", type: "bread" }, null] });
    const moved = tick(state, [{ type: "MOVE", dir: "forward" }]).state;

    const result = tick(moved, [{ type: "CONSUME", characterId: "bram", itemId: "itm_bread" }]);
    expect(result.events).toEqual([{ type: "ItemConsumed", characterId: "bram", itemId: "itm_bread" }]);
  });
});
