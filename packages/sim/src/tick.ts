import { hungerStatus } from "./character/vitals";
import type { Command, MoveDir, TurnDir } from "./commands";
import type { SimEvent } from "./events";
import { FACING_DELTA, type Facing, opposite, turnLeft, turnRight } from "./facing";
import { isWalkable } from "./level/query";
import type { Character, GameState, PartyState, Stat } from "./state";
import {
  decayPerTick,
  HP_DRAIN_PER_TICK_BY_STATUS,
  HP_REGEN_PER_TICK,
  MANA_REGEN_PER_TICK,
  REGEN_MULTIPLIER_BY_STATUS,
  STAMINA_REGEN_PER_TICK,
} from "./tuning";

// Shared gate for both moving and turning — a party mid-tween can't chain a
// second action, mirroring the render-side move/turn tween durations.
export const ACTION_COOLDOWN_TICKS = 2;

export interface TickResult {
  state: GameState;
  events: SimEvent[];
}

/**
 * Whether a command passed to the next tick() will actually resolve. Clients
 * gate their input buffer on this so a queued command isn't silently swallowed
 * by a tick that would reject it.
 *
 * Compares against tick + 1 because tick() advances the counter before
 * resolving commands — a command handed to tick() resolves at tick + 1.
 */
export function canAct(state: GameState): boolean {
  return state.tick + 1 >= state.party.moveCooldownUntil;
}

export function tick(state: GameState, commands: readonly Command[]): TickResult {
  let next: GameState = { ...state, tick: state.tick + 1 };
  const events: SimEvent[] = [];

  for (const command of commands) {
    const result =
      command.type === "MOVE" ? resolveMove(next, command.dir) : resolveTurn(next, command.dir);
    next = result.state;
    events.push(...result.events);
  }

  next = applyVitalsTick(next);

  return { state: next, events };
}

function movementFacing(facing: Facing, dir: MoveDir): Facing {
  switch (dir) {
    case "forward":
      return facing;
    case "back":
      return opposite(facing);
    case "strafeLeft":
      return turnLeft(facing);
    case "strafeRight":
      return turnRight(facing);
  }
}

function withParty(state: GameState, party: Partial<PartyState>): GameState {
  return { ...state, party: { ...state.party, ...party } };
}

function resolveMove(state: GameState, dir: MoveDir): TickResult {
  const { party } = state;
  if (state.tick < party.moveCooldownUntil) {
    return { state, events: [] };
  }

  const moveFacing = movementFacing(party.facing, dir);
  const delta = FACING_DELTA[moveFacing];
  const targetX = party.x + delta.dx;
  const targetZ = party.z + delta.dz;

  if (!isWalkable(state.level, targetX, targetZ)) {
    return {
      state: withParty(state, { moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS }),
      events: [{ type: "PartyBumped", x: targetX, z: targetZ, facing: party.facing }],
    };
  }

  return {
    state: withParty(state, {
      x: targetX,
      z: targetZ,
      moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS,
    }),
    events: [{ type: "PartyMoved", x: targetX, z: targetZ, facing: party.facing }],
  };
}

function resolveTurn(state: GameState, dir: TurnDir): TickResult {
  const { party } = state;
  if (state.tick < party.moveCooldownUntil) {
    return { state, events: [] };
  }

  const facing = dir === "left" ? turnLeft(party.facing) : turnRight(party.facing);
  return {
    state: withParty(state, { facing, moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS }),
    events: [{ type: "PartyTurned", facing }],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function regenStat(stat: Stat, perTick: number, multiplier: number): Stat {
  if (multiplier <= 0 || stat.cur >= stat.max) return stat;
  return { ...stat, cur: clamp(stat.cur + perTick * multiplier, 0, stat.max) };
}

/**
 * Hunger/Thirst decay + status-driven HP/Mana/Stamina regen and HP drain
 * (docs/STATS.md tier table). Runs every tick regardless of commands —
 * "Regeneration ticks are computed in the sim at the fixed tick rate"
 * (ARCHITECTURE.md). devDecayMultiplier scales every rate here (not just
 * decay) so a dev build can watch the whole tier ladder — including
 * Ravenous/Starving HP drain — play out in seconds instead of minutes.
 */
function tickCharacter(character: Character, devDecayMultiplier: number): Character {
  const decay = decayPerTick(character.ravenousness) * devDecayMultiplier;
  const hungerThirst = {
    ...character.hungerThirst,
    cur: clamp(character.hungerThirst.cur - decay, 0, character.hungerThirst.overfeedMax),
  };

  const status = hungerStatus(hungerThirst);
  const regenMult = REGEN_MULTIPLIER_BY_STATUS[status];
  const drain = HP_DRAIN_PER_TICK_BY_STATUS[status] * devDecayMultiplier;

  const hp = regenStat(character.hp, HP_REGEN_PER_TICK * devDecayMultiplier, regenMult);
  const drainedHp = drain > 0 ? { ...hp, cur: clamp(hp.cur - drain, 0, hp.max) } : hp;

  return {
    ...character,
    hungerThirst,
    hp: drainedHp,
    mana: regenStat(character.mana, MANA_REGEN_PER_TICK * devDecayMultiplier, regenMult),
    stamina: regenStat(character.stamina, STAMINA_REGEN_PER_TICK * devDecayMultiplier, regenMult),
  };
}

function applyVitalsTick(state: GameState): GameState {
  const members = state.party.members.map((member) =>
    member ? tickCharacter(member, state.devDecayMultiplier) : member,
  );
  return { ...state, party: { ...state.party, members } };
}
