import {
  getItemType,
  sharedCarryCapacity,
  totalWeight,
  type Character,
  type ItemInstance,
  type PartyState,
} from "@cryptgrid/sim";

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

export type ConsumeRequest = (characterId: string, itemId: string) => void;

function describeItem(item: ItemInstance): string {
  const type = getItemType(item);
  if (!type) return item.type;
  const throwable = type.throwable ? " · throwable" : "";
  return `${type.name} (${type.weight}wt)${throwable}`;
}

/**
 * On-demand full-panel character sheet, opened by SheetController (1-4 /
 * Esc). Shows attributes and class *levels* — never exp, which stays hidden
 * until a reveal spell/item exists (docs/STATS.md "Secrecy"). Inventory is
 * the shared party pool (docs/ROADMAP.md M0.7) — clicking a consumable row
 * fires CONSUME for whichever character's sheet is open.
 */
export class CharacterSheet {
  private readonly backdrop: HTMLElement;
  private readonly card: HTMLElement;

  constructor(
    container: HTMLElement,
    private readonly onConsume: ConsumeRequest,
  ) {
    this.backdrop = container;
    this.backdrop.classList.add("sheet-backdrop");
    this.backdrop.hidden = true;

    this.card = document.createElement("div");
    this.card.className = "sheet-card";
    this.backdrop.appendChild(this.card);
  }

  render(slotIndex: number, party: PartyState): void {
    this.backdrop.hidden = false;
    this.card.innerHTML = "";

    const character = party.members[slotIndex] ?? null;

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

    this.card.appendChild(this.buildVitals(character, party));
    this.card.appendChild(this.buildAttributes(character));
    this.card.appendChild(this.buildClasses(character));
    this.card.appendChild(this.buildHands(character));
    this.card.appendChild(this.buildInventory(party, character.id));
  }

  hide(): void {
    this.backdrop.hidden = true;
  }

  private buildVitals(character: Character, party: PartyState): HTMLElement {
    const { root, body } = section("Vitals");
    body.append(
      vitalLine("HP", character.hp.cur, character.hp.max),
      vitalLine("Mana", character.mana.cur, character.mana.max),
      vitalLine("Stamina", character.stamina.cur, character.stamina.max),
      vitalLine("Carry", totalWeight(party.inventory), sharedCarryCapacity(party.members)),
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

  private buildHands(character: Character): HTMLElement {
    const { root, body } = section("Hands");
    body.className = "sheet-hands";
    character.hands.forEach((item) => {
      const row = document.createElement("div");
      row.className = "sheet-hand";
      row.textContent = item ? describeItem(item) : "— empty —";
      if (item && getItemType(item)?.consumable) {
        row.classList.add("sheet-inventory-consumable");
        row.title = "Click to consume";
        row.addEventListener("click", () => this.onConsume(character.id, item.id));
      }
      body.appendChild(row);
    });
    return root;
  }

  private buildInventory(party: PartyState, characterId: string): HTMLElement {
    const { root, body } = section("Inventory");
    if (party.inventory.length === 0) {
      const empty = document.createElement("div");
      empty.className = "sheet-empty";
      empty.textContent = "Nothing stowed yet.";
      body.appendChild(empty);
      return root;
    }

    for (const item of party.inventory) {
      const type = getItemType(item);
      const row = document.createElement("div");
      row.className = "sheet-inventory-row";
      row.textContent = describeItem(item);
      if (type?.consumable) {
        row.classList.add("sheet-inventory-consumable");
        row.title = "Click to consume";
        row.addEventListener("click", () => this.onConsume(characterId, item.id));
      }
      body.appendChild(row);
    }
    return root;
  }
}
