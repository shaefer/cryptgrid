export type MoveDir = "forward" | "back" | "strafeLeft" | "strafeRight";
export type TurnDir = "left" | "right";

export type Command = { type: "MOVE"; dir: MoveDir } | { type: "TURN"; dir: TurnDir };
