import type { Facing } from "./facing";

export type SimEvent =
  | { type: "PartyMoved"; x: number; z: number; facing: Facing }
  | { type: "PartyTurned"; facing: Facing }
  | { type: "PartyBumped"; x: number; z: number; facing: Facing };
