import type * as THREE from "three";
import type { Command, GameState, HandIndex } from "@cryptgrid/sim";
import type { ItemSprites } from "../scene/items";

export interface InteractionContext {
  camera: THREE.Camera;
  canvas: HTMLElement;
  itemSprites: ItemSprites;
  getState: () => GameState;
  getActiveCharacterId: () => string | null;
}

/**
 * Mouse + F-key world interaction (docs/GAME_DESIGN.md: "Mouse raycast click
 * ... is the universal 'touch' verb; F interacts with whatever is centered
 * ahead."). Left-click/F resolve to PICKUP; right-click resolves to STOW
 * against the active character's own held item — no target, since stowing
 * acts on what you're already holding, not on the world. PICKUP shares the
 * move cooldown gate (buffered depth-1, mirrors KeyboardInput); STOW has no
 * cooldown, so it's applied on the very next tick regardless of canAct().
 *
 * PICKUP only ever resolves against an item on the party's own tile (the
 * sim's same-tile check) — and an item sitting at your own feet is ~1.2
 * world units below eye level at only ~0.75 forward, which falls below the
 * camera's frustum at CAMERA_PITCH_DEG=12 (see apps/game/src/tuning.ts) and
 * so is never raycast-hittable in practice. Tile lookup is therefore the
 * primary resolution path; the raycast is kept as a fallback for whatever's
 * actually centered in view (a future-proofing hook, e.g. multi-tile rooms).
 */
export class InteractionInput {
  private bufferedGated: Command | null = null;
  private bufferedUngated: Command | null = null;
  private attached = false;

  constructor(private readonly ctx: InteractionContext) {}

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.tryPickup(this.ndcFromEvent(event));
    } else if (event.button === 2) {
      event.preventDefault();
      this.tryStow();
    }
  };

  private readonly onContextMenu = (event: MouseEvent): void => {
    event.preventDefault(); // right-click is STOW, not the browser menu
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code !== "KeyF") return;
    event.preventDefault();
    this.tryPickup({ x: 0, y: 0 }); // center-screen crosshair ray
  };

  private ndcFromEvent(event: MouseEvent): { x: number; y: number } {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  private tryPickup(ndc: { x: number; y: number }): void {
    const characterId = this.ctx.getActiveCharacterId();
    if (!characterId) return;
    const itemId =
      this.itemOnCurrentTile() ?? this.ctx.itemSprites.raycast(this.ctx.camera, ndc.x, ndc.y);
    if (!itemId) return;
    this.bufferedGated = { type: "PICKUP", characterId, itemId };
  }

  private itemOnCurrentTile(): string | null {
    const { party, level } = this.ctx.getState();
    const item = level.items.find((i) => i.x === party.x && i.z === party.z);
    return item?.id ?? null;
  }

  private tryStow(): void {
    const characterId = this.ctx.getActiveCharacterId();
    if (!characterId) return;
    const character = this.ctx.getState().party.members.find((member) => member?.id === characterId);
    if (!character) return;
    const handIndex = character.hands.findIndex((hand) => hand !== null);
    if (handIndex === -1) return; // both hands empty — nothing to stow
    this.bufferedUngated = { type: "STOW", characterId, hand: handIndex as HandIndex };
  }

  /** PICKUP, buffered until the sim will actually accept it. */
  takeGatedCommand(): Command | null {
    const command = this.bufferedGated;
    this.bufferedGated = null;
    return command;
  }

  /** STOW, no cooldown — never dropped waiting on canAct(). */
  takeUngatedCommand(): Command | null {
    const command = this.bufferedUngated;
    this.bufferedUngated = null;
    return command;
  }

  attach(target: Window): void {
    if (this.attached) return;
    this.attached = true;
    this.ctx.canvas.addEventListener("mousedown", this.onMouseDown);
    this.ctx.canvas.addEventListener("contextmenu", this.onContextMenu);
    target.addEventListener("keydown", this.onKeyDown);
  }

  detach(target: Window): void {
    if (!this.attached) return;
    this.attached = false;
    this.ctx.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.ctx.canvas.removeEventListener("contextmenu", this.onContextMenu);
    target.removeEventListener("keydown", this.onKeyDown);
  }
}
