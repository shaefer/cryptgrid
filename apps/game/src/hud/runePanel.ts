import {
  allowedTiersAt,
  resolveSpell,
  runeCost,
  runesOfTier,
  RUNES_BY_ID,
  type Command,
  type GameState,
  type RuneTier,
} from "@cryptgrid/sim";

/** Rune id -> raw SVG text, inlined into buttons so CSS `color` tints the stroke (currentColor). */
export type RuneGlyphs = Record<string, string>;

export async function loadRuneGlyphs(): Promise<RuneGlyphs> {
  const entries = await Promise.all(
    Object.keys(RUNES_BY_ID).map(async (id) => {
      const res = await fetch(`${import.meta.env.BASE_URL}assets/runes/${id}.svg`);
      return [id, await res.text()] as const;
    }),
  );
  return Object.fromEntries(entries);
}

const TIER_LABEL: Record<RuneTier, string> = {
  potency: "Potency",
  essence: "Essence",
  form: "Form",
  aspect: "Aspect",
};

const DIGIT_TO_INDEX: Readonly<Record<string, number>> = {
  Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5,
  Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3, Numpad5: 4, Numpad6: 5,
};

/**
 * The Rune Tongue casting panel (docs/SPELLS.md "Casting flow"). Toggled with
 * C; while open, keys 1-6 press runes of the current tier, Backspace erases,
 * Esc clears (or closes when empty), Enter invokes — and those keys are
 * swallowed via stopImmediatePropagation so the 1-4 sheet/character bindings
 * don't fire mid-composition (attach() must therefore run BEFORE
 * SheetController's and ActiveCharacterController's). Composing is legal
 * mid-walk: movement keys pass through untouched.
 */
export class RunePanel {
  private open = false;
  private attached = false;
  private state: GameState | null = null;
  private casterId: string | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly glyphs: RuneGlyphs,
    private readonly sendCommand: (command: Command) => void,
  ) {
    container.classList.add("rune-panel");
    container.hidden = true;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "KeyC") {
      event.preventDefault();
      this.open = !this.open;
      this.render();
      return;
    }
    if (!this.open || !this.casterId) return;

    const runeIndex = DIGIT_TO_INDEX[event.code];
    if (runeIndex !== undefined) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const tier = this.currentTiers()[0];
      const rune = tier ? runesOfTier(tier)[runeIndex] : undefined;
      if (rune) this.sendCommand({ type: "RUNE", characterId: this.casterId, runeId: rune.id });
      return;
    }
    if (event.code === "Backspace") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.sendCommand({ type: "RUNE_ERASE", characterId: this.casterId });
      return;
    }
    if (event.code === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      if ((this.state?.party.runeBuffer.length ?? 0) > 0) {
        this.sendCommand({ type: "RUNE_CLEAR", characterId: this.casterId });
      } else {
        this.open = false;
        this.render();
      }
      return;
    }
    if (event.code === "Enter" || event.code === "NumpadEnter") {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.sendCommand({ type: "INVOKE", characterId: this.casterId });
    }
  };

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

  update(state: GameState, casterId: string | null): void {
    this.state = state;
    this.casterId = casterId;
    if (this.open) this.render();
  }

  private currentTiers(): RuneTier[] {
    return this.state ? allowedTiersAt(this.state.party.runeBuffer) : [];
  }

  private render(): void {
    this.container.hidden = !this.open;
    if (!this.open || !this.state || !this.casterId) {
      this.container.innerHTML = "";
      return;
    }

    const { party } = this.state;
    const caster = party.members.find((m) => m?.id === this.casterId);
    const buffer = party.runeBuffer;
    this.container.innerHTML = "";

    const header = document.createElement("div");
    header.className = "rune-header";
    header.textContent = "The Rune Tongue";
    const hint = document.createElement("span");
    hint.className = "rune-hint";
    hint.textContent = "1–6 rune · Bksp undo · Esc clear · Enter invoke · C close";
    header.appendChild(hint);
    this.container.appendChild(header);

    // The composed sequence so far, plus what it would resolve to.
    const sequence = document.createElement("div");
    sequence.className = "rune-sequence";
    if (buffer.length === 0) {
      sequence.textContent = "— speak a Potency rune —";
    } else {
      for (const id of buffer) {
        sequence.appendChild(this.glyphChip(id));
      }
      const spell = resolveSpell(buffer);
      const label = document.createElement("span");
      label.className = "rune-spell-label";
      label.textContent = spell ? `→ ${spell.name}` : buffer.length >= 2 ? "→ ?" : "";
      sequence.appendChild(label);
    }
    this.container.appendChild(sequence);

    const potencyId = buffer[0] ?? null;
    for (const tier of this.currentTiers()) {
      const row = document.createElement("div");
      row.className = "rune-tier-row";
      const label = document.createElement("div");
      label.className = "rune-tier-label";
      label.textContent = TIER_LABEL[tier];
      row.appendChild(label);

      runesOfTier(tier).forEach((rune, index) => {
        const cost = runeCost(rune.id, potencyId ?? rune.id);
        const affordable = (caster?.mana.cur ?? 0) >= cost;
        const btn = document.createElement("button");
        btn.className = "rune-btn";
        if (!affordable) btn.classList.add("rune-btn-poor");
        btn.title = `${rune.name} — ${cost} mana`;
        btn.innerHTML = this.glyphs[rune.id] ?? "";
        const caption = document.createElement("span");
        caption.className = "rune-btn-caption";
        caption.textContent = `${index + 1} ${rune.name} · ${cost}`;
        btn.appendChild(caption);
        btn.addEventListener("click", () => {
          if (this.casterId) {
            this.sendCommand({ type: "RUNE", characterId: this.casterId, runeId: rune.id });
          }
        });
        row.appendChild(btn);
      });
      this.container.appendChild(row);
    }

    if (buffer.length >= 2) {
      const invoke = document.createElement("button");
      invoke.className = "rune-invoke";
      invoke.textContent = "Invoke";
      invoke.addEventListener("click", () => {
        if (this.casterId) this.sendCommand({ type: "INVOKE", characterId: this.casterId });
      });
      this.container.appendChild(invoke);
    }
  }

  private glyphChip(runeId: string): HTMLElement {
    const chip = document.createElement("span");
    chip.className = "rune-chip";
    chip.innerHTML = this.glyphs[runeId] ?? "";
    const name = document.createElement("span");
    name.textContent = RUNES_BY_ID[runeId]?.name ?? runeId;
    chip.appendChild(name);
    return chip;
  }
}
