import type { Command } from "@cryptgrid/sim";

// Keyed by KeyboardEvent.code so the physical WASD cluster works on any layout.
// Mapping per GAME_DESIGN.md: WASD move/strafe, QE turn, arrows as alternates.
const KEY_COMMANDS: Readonly<Record<string, Command>> = {
  KeyW: { type: "MOVE", dir: "forward" },
  ArrowUp: { type: "MOVE", dir: "forward" },
  KeyS: { type: "MOVE", dir: "back" },
  ArrowDown: { type: "MOVE", dir: "back" },
  KeyA: { type: "MOVE", dir: "strafeLeft" },
  KeyD: { type: "MOVE", dir: "strafeRight" },
  KeyQ: { type: "TURN", dir: "left" },
  ArrowLeft: { type: "TURN", dir: "left" },
  KeyE: { type: "TURN", dir: "right" },
  ArrowRight: { type: "TURN", dir: "right" },
};

/**
 * Turns the keyboard into a one-command-at-a-time source for the sim.
 *
 * Two mechanisms, which together are what makes grid movement feel good:
 *
 * - **Held keys** drive continuous movement. The most recently pressed key
 *   wins, so sliding from W to D mid-corridor strafes immediately instead of
 *   waiting for W to be released.
 * - **A depth-1 buffer** catches a tap that lands mid-tween and replays it the
 *   instant the cooldown clears. Without it, anything pressed during the ~200ms
 *   step is simply lost and chained input feels like it's dropping.
 *
 * The caller must only consume commands when the sim will accept one (canAct),
 * or the buffered tap gets eaten by a tick that rejects it.
 */
export class KeyboardInput {
  private readonly held: string[] = [];
  private buffered: Command | null = null;
  private attached = false;

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const command = KEY_COMMANDS[event.code];
    if (!command) return;
    event.preventDefault(); // arrows would otherwise scroll the page

    if (event.repeat) return; // OS auto-repeat; the held list already covers this

    if (!this.held.includes(event.code)) this.held.push(event.code);
    this.buffered = command; // depth 1: a newer press replaces an older one
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const index = this.held.indexOf(event.code);
    if (index !== -1) this.held.splice(index, 1);
  };

  // Releasing focus mid-stride would otherwise leave the party walking forever.
  private readonly onBlur = (): void => {
    this.held.length = 0;
    this.buffered = null;
  };

  attach(target: Window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
    target.addEventListener("blur", this.onBlur);
  }

  detach(target: Window): void {
    if (!this.attached) return;
    this.attached = false;
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    target.removeEventListener("blur", this.onBlur);
    this.onBlur();
  }

  /** The next command to issue, or null if nothing is buffered or held. */
  takeCommand(): Command | null {
    if (this.buffered) {
      const command = this.buffered;
      this.buffered = null;
      return command;
    }
    const code = this.held[this.held.length - 1];
    return code ? (KEY_COMMANDS[code] ?? null) : null;
  }
}
