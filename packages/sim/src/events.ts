import type { HandIndex } from "./commands";
import type { Facing } from "./facing";

export type SimEvent =
  | { type: "PartyMoved"; x: number; z: number; facing: Facing }
  | { type: "PartyTurned"; facing: Facing }
  | { type: "PartyBumped"; x: number; z: number; facing: Facing }
  | { type: "ItemPickedUp"; characterId: string; itemId: string; hand: HandIndex }
  | { type: "PickupRejected"; characterId: string; itemId: string; reason: "hands-full" | "not-here" }
  | { type: "ItemStowed"; characterId: string; itemId: string; hand: HandIndex }
  | { type: "StowRejected"; characterId: string; itemId: string; reason: "over-capacity" }
  | { type: "ItemConsumed"; characterId: string; itemId: string }
  | { type: "ConsumeRejected"; characterId: string; itemId: string; reason: "not-found" | "not-consumable" }
  | { type: "SwitchActivated"; characterId: string; featureId: string }
  | { type: "InteractRejected"; characterId: string; targetId: string; reason: "not-here" | "not-interactive" }
  | { type: "DoorOpened"; doorId: string }
  | { type: "DoorClosed"; doorId: string }
  | { type: "AlcoveRevealed"; alcoveId: string }
  | { type: "ItemPlacedInAlcove"; characterId: string; alcoveId: string; itemId: string }
  | { type: "PlaceRejected"; characterId: string; alcoveId: string; reason: "not-here" }
  | { type: "RunePressed"; characterId: string; runeId: string; manaSpent: number }
  | { type: "RuneRejected"; characterId: string; runeId: string; reason: "insufficient-mana" | "invalid-order" }
  | { type: "RuneErased"; characterId: string; runeId: string }
  | { type: "RunesCleared"; characterId: string }
  | { type: "SpellCast"; characterId: string; spellId: string; potencyMultiplier: number }
  | { type: "SpellFizzled"; characterId: string; runes: string[] }
  | { type: "ProjectileSpawned"; id: number; kind: "firebolt"; x: number; z: number; facing: Facing; potencyMultiplier: number }
  | { type: "ProjectileMoved"; id: number; x: number; z: number }
  | { type: "ProjectileHitWall"; id: number; x: number; z: number };
