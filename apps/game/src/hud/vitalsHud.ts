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

// Only the four classes visible from the start (docs/STATS.md "Secrecy") —
// Rogue and Bard never render here until M1/M2 add their reveal triggers.
const VISIBLE_CLASS_ORDER = ["fighter", "ranger", "wizard", "priest"] as const;
const CLASS_LABEL: Record<(typeof VISIBLE_CLASS_ORDER)[number], string> = {
  fighter: "Fighter",
  ranger: "Ranger",
  wizard: "Wizard",
  priest: "Priest",
};

function createBarRow(container: HTMLElement, label: string): HTMLDivElement {
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
  return fill;
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

/** Renders the four visible vitals bars, Hunger/Thirst status label, and revealed class levels. */
export class VitalsHud {
  private readonly hpFill: HTMLDivElement;
  private readonly manaFill: HTMLDivElement;
  private readonly staminaFill: HTMLDivElement;
  private readonly hungerFill: HTMLDivElement;
  private readonly statusLabel: HTMLDivElement;
  private readonly classLabel: HTMLDivElement;

  constructor(container: HTMLElement) {
    container.innerHTML = "";
    this.hpFill = createBarRow(container, "HP");
    this.manaFill = createBarRow(container, "Mana");
    this.staminaFill = createBarRow(container, "Stamina");
    this.hungerFill = createBarRow(container, "Hunger");

    this.statusLabel = document.createElement("div");
    this.statusLabel.className = "vital-status";
    container.appendChild(this.statusLabel);

    this.classLabel = document.createElement("div");
    this.classLabel.className = "vital-classes";
    container.appendChild(this.classLabel);
  }

  update(character: Character): void {
    setFill(this.hpFill, character.hp.cur, character.hp.max, HP_COLOR);
    setFill(this.manaFill, character.mana.cur, character.mana.max, MANA_COLOR);
    setFill(this.staminaFill, character.stamina.cur, character.stamina.max, STAMINA_COLOR);
    setHungerFill(this.hungerFill, character.hungerThirst);

    this.statusLabel.textContent = STATUS_LABEL[hungerStatus(character.hungerThirst)];

    this.classLabel.textContent = VISIBLE_CLASS_ORDER.filter(
      (id) => character.classes[id].revealed,
    )
      .map((id) => `${CLASS_LABEL[id]} ${character.classes[id].level}`)
      .join(" · ");
  }
}
