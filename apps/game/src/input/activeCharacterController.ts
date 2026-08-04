import { DIGIT_CODE_TO_SLOT_INDEX } from "./digitKeys";

export type ActiveCharacterChangeListener = (activeSlotIndex: number) => void;

/**
 * Tracks which party slot's hands respond to pickup/stow clicks (docs/ROADMAP.md
 * M0.7). Reuses the same 1-4 keys as SheetController — pressing a number sets
 * the active slot unconditionally, even if that slot is empty; whether an
 * empty slot is a valid pickup target is a call-site concern (main.ts already
 * has `state` in scope there), not this controller's. Pure UI state, same
 * rationale as SheetController: not part of GameState.
 */
export class ActiveCharacterController {
  private activeSlotIndex = 0;
  private attached = false;
  private readonly listeners: ActiveCharacterChangeListener[] = [];

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const slotIndex = DIGIT_CODE_TO_SLOT_INDEX[event.code];
    if (slotIndex === undefined || slotIndex === this.activeSlotIndex) return;
    this.activeSlotIndex = slotIndex;
    this.notify();
  };

  get active(): number {
    return this.activeSlotIndex;
  }

  onChange(listener: ActiveCharacterChangeListener): void {
    this.listeners.push(listener);
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.activeSlotIndex);
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
