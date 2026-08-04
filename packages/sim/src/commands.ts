export type MoveDir = "forward" | "back" | "strafeLeft" | "strafeRight";
export type TurnDir = "left" | "right";
export type HandIndex = 0 | 1;

export type Command =
  | { type: "MOVE"; dir: MoveDir }
  | { type: "TURN"; dir: TurnDir }
  | { type: "PICKUP"; characterId: string; itemId: string }
  | { type: "STOW"; characterId: string; hand: HandIndex }
  | { type: "CONSUME"; characterId: string; itemId: string }
  // The source doing the interacting + the switch/lever feature acted on
  // (docs/ROADMAP.md M0.8) — never the door itself; the resolver walks the
  // feature's own targets[] to find what it flips.
  | { type: "INTERACT"; characterId: string; targetId: string }
  // Held item -> a reachable alcove's shelf (the "place" half of take/place;
  // "take" is PICKUP, which searches alcoves at the party's cell too).
  | { type: "ALCOVE_PLACE"; characterId: string; hand: HandIndex; alcoveId: string };
