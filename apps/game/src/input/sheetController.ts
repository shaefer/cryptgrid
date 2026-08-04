export type SheetChangeListener = (openSlotIndex: number | null) => void;

const DIGIT_CODE_TO_SLOT_INDEX: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

/**
 * Tracks which party slot's character sheet (if any) is open, driven by keys
 * 1-4 and Escape. Pure UI state — deliberately not part of GameState, since
 * "which menu is open" isn't a game rule (packages/sim stays serializable
 * game state only, not UI state).
 *
 * 1-4 toggle: pressing the already-open slot's number closes it; pressing a
 * different number switches straight to that slot without needing to close
 * first.
 */
export class SheetController {
  private openSlotIndex: number | null = null;
  private attached = false;
  private readonly listeners: SheetChangeListener[] = [];

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const slotIndex = DIGIT_CODE_TO_SLOT_INDEX[event.code];
    if (slotIndex !== undefined) {
      event.preventDefault();
      this.openSlotIndex = this.openSlotIndex === slotIndex ? null : slotIndex;
      this.notify();
      return;
    }
    if (event.code === "Escape" && this.openSlotIndex !== null) {
      event.preventDefault();
      this.openSlotIndex = null;
      this.notify();
    }
  };

  get openIndex(): number | null {
    return this.openSlotIndex;
  }

  get isOpen(): boolean {
    return this.openSlotIndex !== null;
  }

  onChange(listener: SheetChangeListener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.openSlotIndex);
  }

  attach(target: Window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener("keydown", this.onKeyDown);
  }

  detach(target: Window): void {
    if (!this.attached) return;
    this.attached = false;
    target.removeEventListener("keydown", this.onKeyDown);
  }
}
