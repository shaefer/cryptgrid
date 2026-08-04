import { beforeEach, describe, expect, it } from "vitest";
import type { RavenousnessTier } from "./character/vitals";
import type { Facing } from "./facing";
import { parseLevel } from "./level/parse";
import type { LevelJSON } from "./level/types";
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
