import * as THREE from "three";
import type { Command, GameState, HandIndex } from "@cryptgrid/sim";

interface RayHit {
  kind: string;
  id: string;
}

export interface InteractionContext {
  camera: THREE.Camera;
  canvas: HTMLElement;
  /** Roots to raycast (recursively) — item sprites, feature meshes, alcove niches. */
  raycastRoots: THREE.Object3D[];
  getState: () => GameState;
  getActiveCharacterId: () => string | null;
  /** Inscriptions are client-side flavor — no sim round-trip, just show the text. */
  onInscription: (featureId: string) => void;
}

/**
 * Mouse + F-key world interaction (docs/GAME_DESIGN.md: "Mouse raycast click
 * ... is the universal 'touch' verb; F interacts with whatever is centered
 * ahead."). One raycast resolves what was touched, and the hit's entityKind
 * decides the verb: floor/alcove items -> PICKUP, switches/levers -> INTERACT,
 * an alcove niche while holding something -> ALCOVE_PLACE, inscriptions ->
 * client-side text. Right-click stays STOW against the active character's own
 * held item — no target, since stowing acts on what you already hold.
 *
 * PICKUP/INTERACT/ALCOVE_PLACE share the move cooldown gate (buffered
 * depth-1, mirrors KeyboardInput); STOW has no cooldown. An item on the
 * party's own tile sits below the camera frustum at CAMERA_PITCH_DEG=12 and
 * is never raycast-hittable, so a miss falls back to tile lookup.
 */
export class InteractionInput {
  private bufferedGated: Command | null = null;
  private bufferedUngated: Command | null = null;
  private attached = false;
  private readonly raycaster = new THREE.Raycaster();

  constructor(private readonly ctx: InteractionContext) {}

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0) {
      this.tryTouch(this.ndcFromEvent(event));
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
    this.tryTouch({ x: 0, y: 0 }); // center-screen crosshair ray
  };

  private ndcFromEvent(event: MouseEvent): { x: number; y: number } {
    const rect = this.ctx.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
      y: -((event.clientY - rect.top) / rect.height) * 2 + 1,
    };
  }

  private raycast(ndc: { x: number; y: number }): RayHit | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), this.ctx.camera);
    const hits = this.raycaster.intersectObjects(this.ctx.raycastRoots, true);
    for (const hit of hits) {
      const id = hit.object.userData.entityId as string | undefined;
      const kind = hit.object.userData.entityKind as string | undefined;
      if (id && kind) return { kind, id };
    }
    return null;
  }

  private tryTouch(ndc: { x: number; y: number }): void {
    const characterId = this.ctx.getActiveCharacterId();
    if (!characterId) return;

    const hit = this.raycast(ndc);
    if (!hit) {
      // Nothing in view — maybe there's an item underfoot (below the frustum).
      const itemId = this.itemOnCurrentTile();
      if (itemId) this.bufferedGated = { type: "PICKUP", characterId, itemId };
      return;
    }

    switch (hit.kind) {
      case "item":
      case "alcove-item":
        this.bufferedGated = { type: "PICKUP", characterId, itemId: hit.id };
        return;
      case "interact":
        this.bufferedGated = { type: "INTERACT", characterId, targetId: hit.id };
        return;
      case "alcove": {
        const hand = this.firstHeldHand(characterId);
        if (hand !== null) {
          this.bufferedGated = { type: "ALCOVE_PLACE", characterId, hand, alcoveId: hit.id };
        }
        return;
      }
      case "inscription":
        this.ctx.onInscription(hit.id);
        return;
      default:
        return; // doors and other tagged-but-passive geometry
    }
  }

  private itemOnCurrentTile(): string | null {
    const { party, level } = this.ctx.getState();
    const item = level.items.find((i) => i.x === party.x && i.z === party.z);
    return item?.id ?? null;
  }

  private firstHeldHand(characterId: string): HandIndex | null {
    const character = this.ctx.getState().party.members.find((m) => m?.id === characterId);
    if (!character) return null;
    const index = character.hands.findIndex((hand) => hand !== null);
    return index === -1 ? null : (index as HandIndex);
  }

  private tryStow(): void {
    const characterId = this.ctx.getActiveCharacterId();
    if (!characterId) return;
    const hand = this.firstHeldHand(characterId);
    if (hand === null) return; // both hands empty — nothing to stow
    this.bufferedUngated = { type: "STOW", characterId, hand };
  }

  /** PICKUP/INTERACT/ALCOVE_PLACE, buffered until the sim will actually accept one. */
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
