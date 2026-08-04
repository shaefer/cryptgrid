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
  | { type: "ConsumeRejected"; characterId: string; itemId: string; reason: "not-found" | "not-consumable" };
