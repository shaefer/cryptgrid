import type { Facing } from "./facing";
import type { LevelRuntime } from "./level/types";

export interface Stat {
  cur: number;
  max: number;
}

export interface Character {
  id: string;
  name: string;
  hp: Stat;
  mana: Stat;
  stamina: Stat;
  food: Stat;
  water: Stat;
}

export interface ItemInstance {
  id: string;
  type: string;
}

export interface PartyState {
  x: number;
  z: number;
  facing: Facing;
  moveCooldownUntil: number;
  members: (Character | null)[];
  inventory: ItemInstance[];
  runeBuffer: string[];
}

export interface GameState {
  tick: number;
  levelId: string;
  level: LevelRuntime;
  party: PartyState;
  projectiles: unknown[]; // Projectile[] arrives with spellcasting in M0.9
  rngState: number;
}

export function createInitialState(level: LevelRuntime, seed: number): GameState {
  return {
    tick: 0,
    levelId: level.id,
    level,
    party: {
      x: level.start.x,
      z: level.start.z,
      facing: level.start.facing,
      moveCooldownUntil: 0,
      members: [null, null, null, null],
      inventory: [],
      runeBuffer: [],
    },
    projectiles: [],
    rngState: seed >>> 0,
  };
}
