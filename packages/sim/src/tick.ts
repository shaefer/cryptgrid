import type { Command, MoveDir, TurnDir } from "./commands";
import type { SimEvent } from "./events";
import { FACING_DELTA, type Facing, opposite, turnLeft, turnRight } from "./facing";
import { isWalkable } from "./level/query";
import type { GameState, PartyState } from "./state";

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
