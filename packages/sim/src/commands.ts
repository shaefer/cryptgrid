export type MoveDir = "forward" | "back" | "strafeLeft" | "strafeRight";
export type TurnDir = "left" | "right";
export type HandIndex = 0 | 1;

export type Command =
  | { type: "MOVE"; dir: MoveDir }
  | { type: "TURN"; dir: TurnDir }
  | { type: "PICKUP"; characterId: string; itemId: string }
  | { type: "STOW"; characterId: string; hand: HandIndex }
  | { type: "CONSUME"; characterId: string; itemId: string };
