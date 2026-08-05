import type { Character } from "@cryptgrid/sim";

const OFFSET_X = 16;
const OFFSET_Y = 16;

/**
 * Shows up to 2 small item icons (one per hand) following the mouse — the
 * missing pickup feedback (docs/ROADMAP.md M0.11): without this, a
 * successful PICKUP looked identical to one the sim silently rejected.
 * Driven by the active character's `hands`, refreshed from the same
 * `updateHud()` call site in main.ts that already reacts to ticks and to
 * active-character switches, so the cursor always reflects whoever's hands
 * are currently doing the picking.
 */
export class HeldItemCursor {
  private readonly root: HTMLElement;
  private readonly handEls: [HTMLElement, HTMLElement];

  constructor() {
    this.root = document.createElement("div");
    this.root.id = "held-item-cursor";
    this.root.hidden = true;

    this.handEls = [document.createElement("div"), document.createElement("div")];
    for (const el of this.handEls) {
      el.className = "held-item-icon";
      el.hidden = true;
      this.root.appendChild(el);
    }
    document.body.appendChild(this.root);

    window.addEventListener("mousemove", this.onMouseMove);
  }

  private readonly onMouseMove = (event: MouseEvent): void => {
    this.root.style.left = `${event.clientX + OFFSET_X}px`;
    this.root.style.top = `${event.clientY + OFFSET_Y}px`;
  };

  update(character: Character | null): void {
    const hands = character?.hands ?? [null, null];
    let anyVisible = false;
    hands.forEach((item, i) => {
      const el = this.handEls[i]!;
      if (item) {
        el.hidden = false;
        el.style.backgroundImage = `url(${import.meta.env.BASE_URL}assets/items/${item.type}.png)`;
        anyVisible = true;
      } else {
        el.hidden = true;
      }
    });
    this.root.hidden = !anyVisible;
  }
}
