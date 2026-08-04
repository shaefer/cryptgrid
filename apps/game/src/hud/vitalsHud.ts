import { hungerStatus, type Character, type HungerStatus, type HungerThirst } from "@cryptgrid/sim";

const HP_COLOR = "#b2453a";
const MANA_COLOR = "#3a6fb2";
const STAMINA_COLOR = "#7ea33a";
const HUNGER_COLOR = "#a3763a";
const OVERFEED_COLOR = "#e8c34a";

const STATUS_LABEL: Record<HungerStatus, string> = {
  gorged: "Gorged",
  wellFed: "Well-Fed",
  satisfied: "Satisfied",
  hungry: "Hungry",
  ravenous: "Ravenous",
  starving: "Starving",
};

function createBarRow(container: HTMLElement, label: string): { fill: HTMLDivElement; track: HTMLDivElement } {
  const row = document.createElement("div");
  row.className = "vital-row";

  const labelEl = document.createElement("span");
  labelEl.className = "vital-label";
  labelEl.textContent = label;

  const track = document.createElement("div");
  track.className = "vital-track";
  const fill = document.createElement("div");
  fill.className = "vital-fill";
  track.appendChild(fill);

  row.append(labelEl, track);
  container.appendChild(row);
  return { fill, track };
}

function setFill(fill: HTMLDivElement, cur: number, max: number, color: string): void {
  const pct = max > 0 ? Math.max(0, Math.min(1, cur / max)) * 100 : 0;
  fill.style.width = `${pct}%`;
  fill.style.background = color;
}

/** Hunger/Thirst renders as one bar spanning 0..overfeedMax, with a hard color
 * stop at the max mark — the overfeed region (past 100%) reads as a visibly
 * different color, not just a longer bar. */
function setHungerFill(fill: HTMLDivElement, bar: HungerThirst): void {
  const widthPct = Math.max(0, Math.min(1, bar.cur / bar.overfeedMax)) * 100;
  const stopPct = (bar.max / bar.overfeedMax) * 100;
  fill.style.width = `${widthPct}%`;
  fill.style.background = `linear-gradient(to right, ${HUNGER_COLOR} 0%, ${HUNGER_COLOR} ${stopPct}%, ${OVERFEED_COLOR} ${stopPct}%, ${OVERFEED_COLOR} 100%)`;
}

/** One compact character's worth of bars — the unit that repeats up to 4 times in VitalsHud. */
class CharacterBlock {
  readonly root: HTMLElement;
  private readonly hpFill: HTMLDivElement;
  private readonly manaFill: HTMLDivElement;
  private readonly staminaFill: HTMLDivElement;
  private readonly hungerFill: HTMLDivElement;
  private readonly hungerStatusEl: HTMLDivElement;

  constructor(slotIndex: number) {
    this.root = document.createElement("div");
    this.root.className = "vital-block";

    const slotLabel = document.createElement("div");
    slotLabel.className = "vital-slot-label";
    slotLabel.textContent = String(slotIndex + 1);
    this.root.appendChild(slotLabel);

    this.hpFill = createBarRow(this.root, "HP").fill;
    this.manaFill = createBarRow(this.root, "MP").fill;
    this.staminaFill = createBarRow(this.root, "SP").fill;

    // Status text overlays the hunger bar itself rather than a separate line —
    // there's no room left once 4 characters share the corner.
    const { fill, track } = createBarRow(this.root, "Hu");
    this.hungerFill = fill;
    this.hungerStatusEl = document.createElement("div");
    this.hungerStatusEl.className = "vital-hunger-status";
    track.appendChild(this.hungerStatusEl);
  }

  update(character: Character): void {
    setFill(this.hpFill, character.hp.cur, character.hp.max, HP_COLOR);
    setFill(this.manaFill, character.mana.cur, character.mana.max, MANA_COLOR);
    setFill(this.staminaFill, character.stamina.cur, character.stamina.max, STAMINA_COLOR);
    setHungerFill(this.hungerFill, character.hungerThirst);
    this.hungerStatusEl.textContent = STATUS_LABEL[hungerStatus(character.hungerThirst)];
  }
}

/**
 * Renders one compact CharacterBlock per filled party slot (docs/ROADMAP.md
 * M0.65). Class levels intentionally don't appear here — that detail moved
 * to the on-demand character sheet (hud/characterSheet.ts) opened with 1-4,
 * since there wasn't room to show both class levels and four characters'
 * worth of bars in one corner.
 */
export class VitalsHud {
  private readonly container: HTMLElement;
  private readonly blocks = new Map<number, CharacterBlock>();

  constructor(container: HTMLElement) {
    this.container = container;
    container.innerHTML = "";
  }

  update(members: readonly (Character | null)[]): void {
    members.forEach((member, index) => {
      if (!member) {
        this.blocks.get(index)?.root.remove();
        this.blocks.delete(index);
        return;
      }
      let block = this.blocks.get(index);
      if (!block) {
        block = new CharacterBlock(index);
        this.container.appendChild(block.root);
        this.blocks.set(index, block);
      }
      block.update(member);
    });
  }
}
