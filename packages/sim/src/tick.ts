import { hungerStatus } from "./character/vitals";
import type { Command, HandIndex, MoveDir, TurnDir } from "./commands";
import type { SimEvent } from "./events";
import { FACING_DELTA, type Facing, opposite, turnLeft, turnRight } from "./facing";
import { getItemType } from "./items/registry";
import { findItemById, isWalkable } from "./level/query";
import type { Character, GameState, Hands, PartyState, Stat } from "./state";
import {
  decayPerTick,
  HP_DRAIN_PER_TICK_BY_STATUS,
  HP_REGEN_PER_TICK,
  MANA_REGEN_PER_TICK,
  REGEN_MULTIPLIER_BY_STATUS,
  sharedCarryCapacity,
  STAMINA_REGEN_PER_TICK,
  totalWeight,
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

function resolveCommand(state: GameState, command: Command): TickResult {
  switch (command.type) {
    case "MOVE":
      return resolveMove(state, command.dir);
    case "TURN":
      return resolveTurn(state, command.dir);
    case "PICKUP":
      return resolvePickup(state, command.characterId, command.itemId);
    case "STOW":
      return resolveStow(state, command.characterId, command.hand);
    case "CONSUME":
      return resolveConsume(state, command.characterId, command.itemId);
  }
}

export function tick(state: GameState, commands: readonly Command[]): TickResult {
  let next: GameState = { ...state, tick: state.tick + 1 };
  const events: SimEvent[] = [];

  for (const command of commands) {
    const result = resolveCommand(next, command);
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

function findMemberIndex(party: PartyState, characterId: string): number {
  return party.members.findIndex((member) => member?.id === characterId);
}

function withMemberAt(state: GameState, index: number, character: Character): GameState {
  const members = state.party.members.slice();
  members[index] = character;
  return { ...state, party: { ...state.party, members } };
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

/**
 * Floor item -> an empty hand. Reuses the party's move cooldown, same as
 * MOVE/TURN (docs/ROADMAP.md M0.7) — physically reaching for something in a
 * real-time dungeon isn't free, unlike STOW's pure inventory bookkeeping.
 */
function resolvePickup(state: GameState, characterId: string, itemId: string): TickResult {
  const { party } = state;
  if (state.tick < party.moveCooldownUntil) {
    return { state, events: [] };
  }

  const cooledDown = withParty(state, { moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS });
  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state: cooledDown, events: [] };

  // Never trust the client's raycast target — re-resolve and validate independently.
  const item = findItemById(state.level, itemId);
  if (!item || item.x !== party.x || item.z !== party.z) {
    return {
      state: cooledDown,
      events: [{ type: "PickupRejected", characterId, itemId, reason: "not-here" }],
    };
  }

  const emptyHandIndex = character.hands.findIndex((hand) => hand === null);
  if (emptyHandIndex === -1) {
    return {
      state: cooledDown,
      events: [{ type: "PickupRejected", characterId, itemId, reason: "hands-full" }],
    };
  }

  const hands = [...character.hands] as Hands;
  hands[emptyHandIndex] = { id: item.id, type: item.type };
  const updated = withMemberAt(cooledDown, memberIndex, { ...character, hands });

  return {
    state: {
      ...updated,
      level: { ...state.level, items: state.level.items.filter((i) => i.id !== itemId) },
    },
    events: [{ type: "ItemPickedUp", characterId, itemId, hand: emptyHandIndex as HandIndex }],
  };
}

/**
 * Held item -> the shared party inventory. Pure bookkeeping, no cooldown —
 * only carry weight gates it, checked here rather than at PICKUP, since
 * holding something shouldn't cost weight, only committing it to the pack
 * should (docs/ROADMAP.md M0.7).
 */
function resolveStow(state: GameState, characterId: string, hand: HandIndex): TickResult {
  const { party } = state;
  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state, events: [] };

  const held = character.hands[hand];
  if (!held) return { state, events: [] }; // empty hand — nothing to stow

  const prospectiveInventory = [...party.inventory, held];
  const capacity = sharedCarryCapacity(party.members);
  if (totalWeight(prospectiveInventory) > capacity) {
    return {
      state,
      events: [{ type: "StowRejected", characterId, itemId: held.id, reason: "over-capacity" }],
    };
  }

  const hands = [...character.hands] as Hands;
  hands[hand] = null;
  const updated = withMemberAt(state, memberIndex, { ...character, hands });

  return {
    state: { ...updated, party: { ...updated.party, inventory: prospectiveInventory } },
    events: [{ type: "ItemStowed", characterId, itemId: held.id, hand }],
  };
}

/**
 * Restores Hunger/Thirst (+ a small kind-specific bonus) and destroys the
 * item. Looks in the character's own hands first, then the shared inventory
 * (docs/ROADMAP.md M0.7).
 */
function resolveConsume(state: GameState, characterId: string, itemId: string): TickResult {
  const { party } = state;
  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state, events: [] };

  const handIndex = character.hands.findIndex((hand) => hand?.id === itemId);
  const inventoryIndex = party.inventory.findIndex((item) => item.id === itemId);
  const item =
    handIndex !== -1 ? character.hands[handIndex] : inventoryIndex !== -1 ? party.inventory[inventoryIndex] : null;

  if (!item) {
    return {
      state,
      events: [{ type: "ConsumeRejected", characterId, itemId, reason: "not-found" }],
    };
  }

  const effect = getItemType(item)?.consumable;
  if (!effect) {
    return {
      state,
      events: [{ type: "ConsumeRejected", characterId, itemId, reason: "not-consumable" }],
    };
  }

  let updatedCharacter: Character = {
    ...character,
    hungerThirst: {
      ...character.hungerThirst,
      cur: clamp(
        character.hungerThirst.cur + effect.amount,
        0,
        character.hungerThirst.overfeedMax,
      ),
    },
  };

  if (effect.bonus) {
    const { stat: statKey, amount } = effect.bonus;
    const stat = updatedCharacter[statKey];
    updatedCharacter = {
      ...updatedCharacter,
      [statKey]: { ...stat, cur: clamp(stat.cur + amount, 0, stat.max) },
    };
  }

  if (handIndex !== -1) {
    const hands = [...updatedCharacter.hands] as Hands;
    hands[handIndex] = null;
    updatedCharacter = { ...updatedCharacter, hands };
  }

  let updated = withMemberAt(state, memberIndex, updatedCharacter);
  if (inventoryIndex !== -1) {
    updated = {
      ...updated,
      party: { ...updated.party, inventory: party.inventory.filter((i) => i.id !== itemId) },
    };
  }

  return { state: updated, events: [{ type: "ItemConsumed", characterId, itemId }] };
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
