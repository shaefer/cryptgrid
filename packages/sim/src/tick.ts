import { recordSpellUse } from "./character/spellMastery";
import { hungerStatus } from "./character/vitals";
import type { Command, HandIndex, MoveDir, TurnDir } from "./commands";
import type { SimEvent } from "./events";
import { FACING_DELTA, type Facing, opposite, turnLeft, turnRight } from "./facing";
import { getItemType } from "./items/registry";
import { alcovesAt, findDoorById, findFeatureById, findItemById, isWalkable } from "./level/query";
import type { AlcoveFeature, SwitchAction } from "./level/types";
import {
  FIREBOLT_DAMAGE_PER_MULTIPLIER,
  LIGHT_DURATION_TICKS_PER_MULTIPLIER,
  PROJECTILE_TICKS_PER_TILE,
  resolveSpell,
} from "./spells/registry";
import { allowedTiersAt, potencyMultiplier, RUNES_BY_ID, runeCost } from "./spells/runes";
import type { Character, GameState, Hands, PartyState, Projectile, Stat } from "./state";
import {
  decayPerTick,
  HP_DRAIN_PER_TICK_BY_STATUS,
  HP_REGEN_PER_TICK,
  MANA_REGEN_PER_TICK,
  PICKUP_RANGE_TILES,
  pickupDistance,
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
    case "INTERACT":
      return resolveInteract(state, command.characterId, command.targetId);
    case "ALCOVE_PLACE":
      return resolveAlcovePlace(state, command.characterId, command.hand, command.alcoveId);
    case "RUNE":
      return resolveRune(state, command.characterId, command.runeId);
    case "RUNE_ERASE":
      return resolveRuneErase(state, command.characterId);
    case "RUNE_CLEAR":
      return resolveRuneClear(state, command.characterId);
    case "INVOKE":
      return resolveInvoke(state, command.characterId);
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

  const projectilePhase = tickProjectiles(next);
  next = projectilePhase.state;
  events.push(...projectilePhase.events);

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
 * Floor or alcove item -> an empty hand. Reuses the party's move cooldown,
 * same as MOVE/TURN (docs/ROADMAP.md M0.7) — physically reaching for
 * something in a real-time dungeon isn't free, unlike STOW's pure inventory
 * bookkeeping. Alcove items are reachable only from the alcove's own floor
 * cell, and never from a still-hidden alcove (docs/ROADMAP.md M0.8).
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
  // "Your tile, or the near half of the next one" (docs/ROADMAP.md M0.11):
  // a distance check against the item's own slot-offset position, not tile
  // equality, so items on an adjacent tile's near-side slot are reachable.
  const floorItem = findItemById(state.level, itemId);
  const inRange =
    !!floorItem &&
    pickupDistance(party.x, party.z, floorItem.x, floorItem.z, floorItem.slot ?? "center") <=
      PICKUP_RANGE_TILES;
  const alcove = inRange
    ? undefined
    : alcovesAt(state.level, party.x, party.z).find((a) => a.items.some((i) => i.id === itemId));

  if (!inRange && !alcove) {
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

  const taken = inRange ? floorItem : alcove?.items.find((i) => i.id === itemId);
  if (!taken) return { state: cooledDown, events: [] }; // unreachable; narrows types

  const hands = [...character.hands] as Hands;
  hands[emptyHandIndex] = { id: taken.id, type: taken.type };
  const updated = withMemberAt(cooledDown, memberIndex, { ...character, hands });

  const level = inRange
    ? { ...state.level, items: state.level.items.filter((i) => i.id !== itemId) }
    : {
        ...state.level,
        wallFeatures: state.level.wallFeatures.map((f) =>
          f.id === alcove?.id && f.type === "alcove"
            ? { ...f, items: f.items.filter((i) => i.id !== itemId) }
            : f,
        ),
      };

  return {
    state: { ...updated, level },
    events: [{ type: "ItemPickedUp", characterId, itemId, hand: emptyHandIndex as HandIndex }],
  };
}

/**
 * Switch/lever activation (docs/ROADMAP.md M0.8). Cooldown-gated like
 * MOVE/PICKUP. The party must be standing in the feature's own floor cell;
 * the resolver walks the feature's authored targets[]/action to flip door
 * open-state and reveal hidden alcoves, emitting an event per actual change.
 */
function resolveInteract(state: GameState, characterId: string, targetId: string): TickResult {
  const { party } = state;
  if (state.tick < party.moveCooldownUntil) {
    return { state, events: [] };
  }

  const cooledDown = withParty(state, { moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS });
  const feature = findFeatureById(state.level, targetId);

  if (!feature || feature.x !== party.x || feature.z !== party.z) {
    return {
      state: cooledDown,
      events: [{ type: "InteractRejected", characterId, targetId, reason: "not-here" }],
    };
  }
  if (feature.type !== "switch" && feature.type !== "lever") {
    return {
      state: cooledDown,
      events: [{ type: "InteractRejected", characterId, targetId, reason: "not-interactive" }],
    };
  }

  const events: SimEvent[] = [{ type: "SwitchActivated", characterId, featureId: feature.id }];
  let doors = state.level.doors;
  let wallFeatures = state.level.wallFeatures;

  for (const id of feature.targets) {
    const door = findDoorById(state.level, id);
    if (door) {
      const nextOpen = applySwitchAction(door.open, feature.action);
      if (nextOpen !== door.open) {
        doors = doors.map((d) => (d.id === id ? { ...d, open: nextOpen } : d));
        events.push(nextOpen ? { type: "DoorOpened", doorId: id } : { type: "DoorClosed", doorId: id });
      }
      continue;
    }
    const target = findFeatureById(state.level, id);
    if (target?.type === "alcove" && target.hidden) {
      // Reveals are one-way: no switch action re-hides an alcove.
      wallFeatures = wallFeatures.map((f) =>
        f.id === id && f.type === "alcove" ? { ...f, hidden: false } : f,
      );
      events.push({ type: "AlcoveRevealed", alcoveId: id });
    }
  }

  return {
    state: { ...cooledDown, level: { ...state.level, doors, wallFeatures } },
    events,
  };
}

function applySwitchAction(open: boolean, action: SwitchAction): boolean {
  switch (action) {
    case "toggle":
      return !open;
    case "open":
      return true;
    case "close":
      return false;
  }
}

/**
 * Held item -> a reachable alcove's shelf (the "place" half of take/place —
 * "take" is PICKUP). Cooldown-gated like PICKUP: physically setting something
 * into a niche, not inventory bookkeeping.
 */
function resolveAlcovePlace(
  state: GameState,
  characterId: string,
  hand: HandIndex,
  alcoveId: string,
): TickResult {
  const { party } = state;
  if (state.tick < party.moveCooldownUntil) {
    return { state, events: [] };
  }

  const cooledDown = withParty(state, { moveCooldownUntil: state.tick + ACTION_COOLDOWN_TICKS });
  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state: cooledDown, events: [] };

  const held = character.hands[hand];
  if (!held) return { state: cooledDown, events: [] }; // empty hand — nothing to place

  const alcove = alcovesAt(state.level, party.x, party.z).find(
    (a): a is AlcoveFeature => a.id === alcoveId,
  );
  if (!alcove) {
    return {
      state: cooledDown,
      events: [{ type: "PlaceRejected", characterId, alcoveId, reason: "not-here" }],
    };
  }

  const hands = [...character.hands] as Hands;
  hands[hand] = null;
  const updated = withMemberAt(cooledDown, memberIndex, { ...character, hands });

  return {
    state: {
      ...updated,
      level: {
        ...state.level,
        wallFeatures: state.level.wallFeatures.map((f) =>
          f.id === alcoveId && f.type === "alcove" ? { ...f, items: [...f.items, held] } : f,
        ),
      },
    },
    events: [{ type: "ItemPlacedInAlcove", characterId, alcoveId, itemId: held.id }],
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

/**
 * Rune press (docs/SPELLS.md "Casting flow"). No cooldown — composing is
 * free-flowing and legal mid-walk. Mana is paid *now*, per rune, scaled by
 * the buffer's potency; not enough mana and the rune simply won't light.
 */
function resolveRune(state: GameState, characterId: string, runeId: string): TickResult {
  const { party } = state;
  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state, events: [] };

  const rune = RUNES_BY_ID[runeId];
  if (!rune || !allowedTiersAt(party.runeBuffer).includes(rune.tier)) {
    return {
      state,
      events: [{ type: "RuneRejected", characterId, runeId, reason: "invalid-order" }],
    };
  }

  const potencyId = party.runeBuffer[0] ?? runeId;
  const cost = runeCost(runeId, potencyId);
  if (character.mana.cur < cost) {
    return {
      state,
      events: [{ type: "RuneRejected", characterId, runeId, reason: "insufficient-mana" }],
    };
  }

  const paid = withMemberAt(state, memberIndex, {
    ...character,
    mana: { ...character.mana, cur: character.mana.cur - cost },
  });
  return {
    state: { ...paid, party: { ...paid.party, runeBuffer: [...party.runeBuffer, runeId] } },
    events: [{ type: "RunePressed", characterId, runeId, manaSpent: cost }],
  };
}

/** Backspace: removes the last rune. Mana spent is spent — no refund (SPELLS.md's pay-as-you-compose tension). */
function resolveRuneErase(state: GameState, characterId: string): TickResult {
  const buffer = state.party.runeBuffer;
  const last = buffer[buffer.length - 1];
  if (last === undefined) return { state, events: [] };
  return {
    state: { ...state, party: { ...state.party, runeBuffer: buffer.slice(0, -1) } },
    events: [{ type: "RuneErased", characterId, runeId: last }],
  };
}

function resolveRuneClear(state: GameState, characterId: string): TickResult {
  if (state.party.runeBuffer.length === 0) return { state, events: [] };
  return {
    state: { ...state, party: { ...state.party, runeBuffer: [] } },
    events: [{ type: "RunesCleared", characterId }],
  };
}

/**
 * Invoke the composed sequence (docs/SPELLS.md). Valid -> the spell resolves
 * and mastery ticks up; unknown -> fizzle, mana already spent is lost. Either
 * way the buffer clears. Deterministic in M0 — mastery only starts nudging
 * success chance in M1.
 */
function resolveInvoke(state: GameState, characterId: string): TickResult {
  const { party } = state;
  if (party.runeBuffer.length === 0) return { state, events: [] };

  const memberIndex = findMemberIndex(party, characterId);
  const character = memberIndex === -1 ? null : party.members[memberIndex];
  if (!character) return { state, events: [] };

  const spell = resolveSpell(party.runeBuffer);
  const cleared = { ...state, party: { ...state.party, runeBuffer: [] } };

  if (!spell) {
    return {
      state: cleared,
      events: [{ type: "SpellFizzled", characterId, runes: [...party.runeBuffer] }],
    };
  }

  const multiplier = potencyMultiplier(party.runeBuffer[0] ?? "");
  const withMastery = withMemberAt(cleared, memberIndex, {
    ...character,
    spellMastery: recordSpellUse(character.spellMastery, spell.id, true),
  });
  const events: SimEvent[] = [
    { type: "SpellCast", characterId, spellId: spell.id, potencyMultiplier: multiplier },
  ];

  if (spell.id === "light") {
    const until = state.tick + LIGHT_DURATION_TICKS_PER_MULTIPLIER * multiplier;
    return {
      state: {
        ...withMastery,
        party: {
          ...withMastery.party,
          // Stacking refreshes — a weaker recast never shortens a stronger one.
          lightBoostUntil: Math.max(withMastery.party.lightBoostUntil, until),
        },
      },
      events,
    };
  }

  // Firebolt: spawn at the party's own tile; first advance comes after
  // PROJECTILE_TICKS_PER_TILE ticks, so a point-blank wall still gets hit.
  const projectile: Projectile = {
    id: state.nextProjectileId,
    kind: "firebolt",
    x: party.x,
    z: party.z,
    facing: party.facing,
    potencyMultiplier: multiplier,
    damage: FIREBOLT_DAMAGE_PER_MULTIPLIER * multiplier,
    lastMovedTick: state.tick,
  };
  events.push({
    type: "ProjectileSpawned",
    id: projectile.id,
    kind: "firebolt",
    x: projectile.x,
    z: projectile.z,
    facing: projectile.facing,
    potencyMultiplier: multiplier,
  });
  return {
    state: {
      ...withMastery,
      projectiles: [...withMastery.projectiles, projectile],
      nextProjectileId: state.nextProjectileId + 1,
    },
    events,
  };
}

/** Advances every projectile that's due to move this tick; walls and closed doors stop them. */
function tickProjectiles(state: GameState): TickResult {
  if (state.projectiles.length === 0) return { state, events: [] };

  const events: SimEvent[] = [];
  const survivors: Projectile[] = [];

  for (const projectile of state.projectiles) {
    if (state.tick - projectile.lastMovedTick < PROJECTILE_TICKS_PER_TILE) {
      survivors.push(projectile);
      continue;
    }
    const delta = FACING_DELTA[projectile.facing];
    const nx = projectile.x + delta.dx;
    const nz = projectile.z + delta.dz;
    if (!isWalkable(state.level, nx, nz)) {
      events.push({ type: "ProjectileHitWall", id: projectile.id, x: nx, z: nz });
      continue; // consumed on impact
    }
    survivors.push({ ...projectile, x: nx, z: nz, lastMovedTick: state.tick });
    events.push({ type: "ProjectileMoved", id: projectile.id, x: nx, z: nz });
  }

  return { state: { ...state, projectiles: survivors }, events };
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
