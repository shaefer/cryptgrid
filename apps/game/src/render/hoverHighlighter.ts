import * as THREE from "three";
import { pickupDistance, PICKUP_RANGE_TILES, type GameState } from "@cryptgrid/sim";
import type { FeatureViews } from "../scene/features";
import type { ItemSprites } from "../scene/items";

export interface HoverHighlighterContext {
  camera: THREE.Camera;
  canvas: HTMLElement;
  itemSprites: ItemSprites;
  featureViews: FeatureViews;
  getState: () => GameState;
}

/**
 * Continuous per-frame hover raycast (docs/ROADMAP.md M0.11) — separate from
 * InteractionInput's click/F-key discrete commands, which only fire on
 * input events. Drives two purely client-side visual cues, neither touching
 * sim state: a light-blue glow on floor items the player could actually
 * pick up right now (docs/ROADMAP.md M0.11's tightened pickup range), and a
 * light-yellow tint on a secret-switch face while the reticle is on it
 * (hover-only "found it" tell, no persistent discovered state).
 */
export class HoverHighlighter {
  private readonly raycaster = new THREE.Raycaster();
  private readonly ndc = new THREE.Vector2();
  private attached = false;

  constructor(private readonly ctx: HoverHighlighterContext) {}

  private readonly onMouseMove = (event: MouseEvent): void => {
    const rect = this.ctx.canvas.getBoundingClientRect();
    this.ndc.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.ndc.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  };

  attach(target: Window): void {
    if (this.attached) return;
    this.attached = true;
    target.addEventListener("mousemove", this.onMouseMove);
  }

  detach(target: Window): void {
    if (!this.attached) return;
    this.attached = false;
    target.removeEventListener("mousemove", this.onMouseMove);
  }

  /** Call once per rendered frame (main.ts, alongside partyView.update/doorViews.update). */
  update(): void {
    this.raycaster.setFromCamera(this.ndc, this.ctx.camera);

    const itemHit = this.raycaster.intersectObjects(this.ctx.itemSprites.group.children, false)[0];
    const itemId =
      itemHit?.object.userData.entityKind === "item"
        ? (itemHit.object.userData.entityId as string)
        : null;
    this.ctx.itemSprites.setHovered(itemId !== null && this.itemInPickupRange(itemId) ? itemId : null);

    const switchHits = this.raycaster.intersectObjects(
      this.ctx.featureViews.interactiveGroup.children,
      true,
    );
    const switchHit = switchHits.find((hit) => hit.object.userData.secretSwitch === true);
    this.ctx.featureViews.setHoveredSwitch((switchHit?.object.userData.entityId as string) ?? null);
  }

  /** Mirrors packages/sim/src/tick.ts's resolvePickup — the hover cue never promises a pickup the sim would reject. */
  private itemInPickupRange(itemId: string): boolean {
    const { party, level } = this.ctx.getState();
    const item = level.items.find((i) => i.id === itemId);
    if (!item) return false;
    return (
      pickupDistance(party.x, party.z, item.x, item.z, item.slot ?? "center") <= PICKUP_RANGE_TILES
    );
  }
}
