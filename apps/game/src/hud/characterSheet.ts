import type { Character } from "@cryptgrid/sim";

// Same four classes as the compact HUD's visibility rule (docs/STATS.md
// "Secrecy") — Rogue/Bard never appear here until their reveal trigger fires.
const VISIBLE_CLASS_ORDER = ["fighter", "ranger", "wizard", "priest"] as const;
const CLASS_LABEL: Record<(typeof VISIBLE_CLASS_ORDER)[number], string> = {
  fighter: "Fighter",
  ranger: "Ranger",
  wizard: "Wizard",
  priest: "Priest",
};

const ATTRIBUTE_ORDER = ["str", "dex", "cha", "vit", "wis", "int"] as const;
const ATTRIBUTE_LABEL: Record<(typeof ATTRIBUTE_ORDER)[number], string> = {
  str: "STR",
  dex: "DEX",
  cha: "CHA",
  vit: "VIT",
  wis: "WIS",
  int: "INT",
};

function section(title: string): { root: HTMLElement; body: HTMLElement } {
  const root = document.createElement("div");
  root.className = "sheet-section";
  const heading = document.createElement("div");
  heading.className = "sheet-section-title";
  heading.textContent = title;
  const body = document.createElement("div");
  root.append(heading, body);
  return { root, body };
}

function vitalLine(label: string, cur: number, max: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "sheet-vital-row";
  row.textContent = `${label}  ${Math.round(cur)} / ${Math.round(max)}`;
  return row;
}

/**
 * On-demand full-panel character sheet, opened by SheetController (1-4 /
 * Esc). Shows attributes and class *levels* — never exp, which stays hidden
 * until a reveal spell/item exists (docs/STATS.md "Secrecy"). Inventory is a
 * placeholder until M0.7 builds items.
 */
export class CharacterSheet {
  private readonly backdrop: HTMLElement;
  private readonly card: HTMLElement;

  constructor(container: HTMLElement) {
    this.backdrop = container;
    this.backdrop.classList.add("sheet-backdrop");
    this.backdrop.hidden = true;

    this.card = document.createElement("div");
    this.card.className = "sheet-card";
    this.backdrop.appendChild(this.card);
  }

  render(slotIndex: number, character: Character | null): void {
    this.backdrop.hidden = false;
    this.card.innerHTML = "";

    const header = document.createElement("div");
    header.className = "sheet-header";
    const name = document.createElement("span");
    name.className = "sheet-name";
    name.textContent = character ? character.name : `Slot ${slotIndex + 1}`;
    const hint = document.createElement("span");
    hint.className = "sheet-hint";
    hint.textContent = "1–4 switch · Esc close";
    header.append(name, hint);
    this.card.appendChild(header);

    if (!character) {
      const empty = document.createElement("div");
      empty.className = "sheet-empty";
      empty.textContent = "No character in this slot yet.";
      this.card.appendChild(empty);
      return;
    }

    this.card.appendChild(this.buildVitals(character));
    this.card.appendChild(this.buildAttributes(character));
    this.card.appendChild(this.buildClasses(character));
    this.card.appendChild(this.buildInventory());
  }

  hide(): void {
    this.backdrop.hidden = true;
  }

  private buildVitals(character: Character): HTMLElement {
    const { root, body } = section("Vitals");
    body.append(
      vitalLine("HP", character.hp.cur, character.hp.max),
      vitalLine("Mana", character.mana.cur, character.mana.max),
      vitalLine("Stamina", character.stamina.cur, character.stamina.max),
    );
    return root;
  }

  private buildAttributes(character: Character): HTMLElement {
    const { root, body } = section("Attributes");
    body.className = "sheet-attr-grid";
    for (const id of ATTRIBUTE_ORDER) {
      const cell = document.createElement("div");
      cell.className = "sheet-attr";
      const label = document.createElement("span");
      label.className = "sheet-attr-label";
      label.textContent = ATTRIBUTE_LABEL[id];
      const value = document.createElement("span");
      value.className = "sheet-attr-value";
      value.textContent = String(character.attributes[id]);
      cell.append(label, value);
      body.appendChild(cell);
    }
    return root;
  }

  private buildClasses(character: Character): HTMLElement {
    const { root, body } = section("Classes");
    for (const id of VISIBLE_CLASS_ORDER) {
      const progress = character.classes[id];
      if (!progress.revealed) continue;
      const row = document.createElement("div");
      row.className = "sheet-class-row";
      row.textContent = `${CLASS_LABEL[id]} — Lv ${progress.level}`;
      body.appendChild(row);
    }
    return root;
  }

  private buildInventory(): HTMLElement {
    const { root, body } = section("Inventory");
    const empty = document.createElement("div");
    empty.className = "sheet-empty";
    empty.textContent = "Nothing here yet.";
    body.appendChild(empty);
    return root;
  }
}
