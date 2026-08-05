import * as THREE from "three";
import {
  resolveWallVariant,
  stringHash,
  type AlcoveItem,
  type LevelRuntime,
  type SimEvent,
} from "@cryptgrid/sim";
import { TILE_SIZE, WALL_HEIGHT, type BoundaryFace } from "./buildLevel";
import { itemVisualScale } from "./itemVisuals";
import type { ItemTextures } from "./itemTextures";
import type { DungeonTextures } from "./textures";

const NICHE_DEPTH = 0.6;
/** Just proud of the shelf plane — avoids z-fighting without floating visibly. */
const ALCOVE_ITEM_Y_OFFSET = 0.015;
const OVERLAY_OFFSET = 0.03; // proud of the wall so it never z-fights

/** Hover-only secret-switch tell (docs/ROADMAP.md M0.11) — no persistent "discovered" state. */
const SECRET_SWITCH_HOVER_EMISSIVE = 0xffe066;
const SECRET_SWITCH_HOVER_INTENSITY = 0.18;
/**
 * Shelf height in niche-local space (group origin is at WALL_HEIGHT/2) —
 * ~0.95 world units up. Calibrated so a shelf item straddles the F-key's
 * center-screen ray (eye 1.5, pitched down 12° ≈ y 1.10 at niche distance):
 * at -0.35 the sprite's bottom edge cleared the ray by 4cm and F never
 * connected (found via Playwright).
 */
const SHELF_LOCAL_Y = -0.55;

/** What a raycast hit on a feature object means to InteractionInput. */
export type EntityKind = "interact" | "alcove" | "alcove-item" | "inscription";

interface AlcoveView {
  face: BoundaryFace;
  /** null while hidden — the placeholder wall face stands in for the niche. */
  niche: THREE.Group | null;
  hiddenFace: THREE.Mesh | null;
  itemMeshes: Map<string, THREE.Mesh>;
}

function faceGroupAt(face: BoundaryFace): THREE.Group {
  const group = new THREE.Group();
  group.position.copy(face.position);
  group.rotation.set(0, face.rotationY, 0);
  return group;
}

/**
 * Everything wall-mounted: secret-switch faces, visible switches, levers,
 * inscriptions, and alcove niches (ROADMAP.md M0.8 — wallFeatures render in
 * 3D for the first time). A hidden alcove renders an ordinary wall face using
 * its cell's own variant hash — no tell of its own, only switches get one —
 * until `update()` sees the sim flip `hidden` and swaps in the recessed niche.
 * Alcove item meshes reconcile against sim state the same way ItemSprites
 * does for floor items.
 */
export class FeatureViews {
  /** Raycast against `.children` (recursive) — every object carries entityId/entityKind. */
  readonly interactiveGroup = new THREE.Group();
  private readonly alcoves = new Map<string, AlcoveView>();
  private readonly leverMeshes = new Map<string, THREE.Mesh>();
  private readonly leverOn = new Map<string, boolean>();
  private readonly secretSwitchMeshes = new Map<string, THREE.Mesh>();
  private hoveredSwitchId: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly level: LevelRuntime,
    private readonly textures: DungeonTextures,
    private readonly itemTextures: ItemTextures,
    featureFaces: Map<string, BoundaryFace>,
  ) {
    scene.add(this.interactiveGroup);

    for (const feature of level.wallFeatures) {
      const claimedFace = featureFaces.get(feature.id);

      if (feature.type === "switch" && feature.variant === "secretBrick") {
        if (claimedFace) this.buildSecretSwitchFace(feature.id, claimedFace);
        continue;
      }
      if (feature.type === "alcove") {
        if (!claimedFace) continue;
        const view: AlcoveView = {
          face: claimedFace,
          niche: null,
          hiddenFace: null,
          itemMeshes: new Map(),
        };
        this.alcoves.set(feature.id, view);
        if (feature.hidden) {
          this.buildHiddenAlcoveFace(view);
        } else {
          this.buildNiche(feature.id, view);
        }
        continue;
      }

      // Switch (visible), lever, inscription: overlay quads on the (still
      // instanced) wall face behind them. Their boundary is recomputed here
      // since buildLevel only excludes secret-switch/alcove faces.
      const overlayFace = boundaryFor(feature.x, feature.z, feature.face);
      if (feature.type === "switch") {
        this.buildOverlay(feature.id, "interact", overlayFace, this.textures.featureSwitch, 0.7, 0.7);
      } else if (feature.type === "lever") {
        const mesh = this.buildOverlay(feature.id, "interact", overlayFace, this.textures.featureLever, 0.9, 0.9);
        this.leverMeshes.set(feature.id, mesh);
        this.leverOn.set(feature.id, false);
      } else {
        const mesh = this.buildPlaque(feature.id, overlayFace);
        this.interactiveGroup.add(mesh);
      }
    }
  }

  /** Reconciles alcove visibility + shelf contents against live sim state. Call when the sim ticked. */
  update(level: LevelRuntime): void {
    for (const feature of level.wallFeatures) {
      if (feature.type !== "alcove") continue;
      const view = this.alcoves.get(feature.id);
      if (!view) continue;

      if (!feature.hidden && view.niche === null) {
        // Just revealed: swap the plain wall face for the niche.
        if (view.hiddenFace) {
          this.interactiveGroup.remove(view.hiddenFace);
          this.scene.remove(view.hiddenFace);
          view.hiddenFace = null;
        }
        this.buildNiche(feature.id, view);
      }
      if (view.niche) this.reconcileAlcoveItems(view, feature.items);
    }
  }

  /** Levers flip their handle on each activation. */
  handleEvent(event: SimEvent): void {
    if (event.type !== "SwitchActivated") return;
    const mesh = this.leverMeshes.get(event.featureId);
    if (!mesh) return;
    const on = !(this.leverOn.get(event.featureId) ?? false);
    this.leverOn.set(event.featureId, on);
    (mesh.material as THREE.MeshBasicMaterial).map = on
      ? this.textures.featureLeverOn
      : this.textures.featureLever;
    (mesh.material as THREE.MeshBasicMaterial).needsUpdate = true;
  }

  /**
   * The full-size wall face a secret switch hides in — its cell's own variant,
   * but one of that variant's dedicated tell textures (conspicuous carved-recess
   * or subtle grunge-blend, docs/ROADMAP.md M0.11): the tell always blends with
   * the stone that actually surrounds it (ASSETS.md), and which of the variant's
   * tells this particular switch gets is deterministic from its own id — same
   * switch always renders the same way. Falls back to the plain `base` texture
   * if the cell resolved to a transition variant (no tells of its own — an
   * authoring mistake, not a case worth a hard validate.ts error over).
   */
  private buildSecretSwitchFace(featureId: string, face: BoundaryFace): void {
    const variantId = resolveWallVariant(this.level, face.wallCellX, face.wallCellZ);
    const variant = this.textures.wallVariants[variantId];
    const tells = variant.secretTells;
    const tellTexture = tells.length > 0 ? tells[stringHash(featureId) % tells.length]! : variant.base;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
      new THREE.MeshStandardMaterial({ map: tellTexture, roughness: 0.95 }),
    );
    mesh.position.copy(face.position);
    mesh.rotation.set(0, face.rotationY, 0);
    mesh.userData.entityId = featureId;
    mesh.userData.entityKind = "interact" satisfies EntityKind;
    mesh.userData.secretSwitch = true; // hoverHighlighter.ts's cue to distinguish from ordinary switches/levers
    this.secretSwitchMeshes.set(featureId, mesh);
    this.interactiveGroup.add(mesh);
  }

  /**
   * Toggles the hover-only light-yellow tell on at most one secret switch at
   * a time — the hover highlighter (render/hoverHighlighter.ts) calls this
   * once per frame with whichever secret-switch face the reticle is
   * currently over, or null. No sim state, no persistence: purely "is the
   * player looking at it right now."
   */
  setHoveredSwitch(featureId: string | null): void {
    if (featureId === this.hoveredSwitchId) return;
    const previous = this.hoveredSwitchId
      ? this.secretSwitchMeshes.get(this.hoveredSwitchId)
      : undefined;
    if (previous) {
      const material = previous.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0;
    }
    const next = featureId ? this.secretSwitchMeshes.get(featureId) : undefined;
    if (next) {
      const material = next.material as THREE.MeshStandardMaterial;
      material.emissive.set(SECRET_SWITCH_HOVER_EMISSIVE);
      material.emissiveIntensity = SECRET_SWITCH_HOVER_INTENSITY;
    }
    this.hoveredSwitchId = featureId;
  }

  /** A hidden alcove is just wall: its cell's base variant, no entity tag, nothing to find by clicking. */
  private buildHiddenAlcoveFace(view: AlcoveView): void {
    const variantId = resolveWallVariant(this.level, view.face.wallCellX, view.face.wallCellZ);
    const variant = this.textures.wallVariants[variantId];
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT),
      new THREE.MeshStandardMaterial({ map: variant.base, roughness: 0.95 }),
    );
    mesh.position.copy(view.face.position);
    mesh.rotation.set(0, view.face.rotationY, 0);
    view.hiddenFace = mesh;
    this.scene.add(mesh);
  }

  /**
   * Recessed niche: back panel + four inner walls + a shelf at reach height,
   * all in the alcove-back treatment. The material is tinted down on top of
   * the already-darker texture — at torch range the recess otherwise reads as
   * flat wall (found via Playwright screenshot).
   */
  private buildNiche(alcoveId: string, view: AlcoveView): void {
    const group = faceGroupAt(view.face);
    const material = new THREE.MeshStandardMaterial({
      map: this.textures.alcoveBack,
      color: 0x707070,
      roughness: 1,
    });

    const back = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT), material);
    back.position.z = -NICHE_DEPTH;
    back.userData.entityId = alcoveId;
    back.userData.entityKind = "alcove" satisfies EntityKind;

    const top = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, NICHE_DEPTH), material);
    top.rotation.x = Math.PI / 2;
    top.position.set(0, WALL_HEIGHT / 2, -NICHE_DEPTH / 2);

    const bottom = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, NICHE_DEPTH), material);
    bottom.rotation.x = -Math.PI / 2;
    bottom.position.set(0, -WALL_HEIGHT / 2, -NICHE_DEPTH / 2);
    bottom.userData.entityId = alcoveId;
    bottom.userData.entityKind = "alcove" satisfies EntityKind;

    const left = new THREE.Mesh(new THREE.PlaneGeometry(NICHE_DEPTH, WALL_HEIGHT), material);
    left.rotation.y = Math.PI / 2;
    left.position.set(-TILE_SIZE / 2, 0, -NICHE_DEPTH / 2);

    const right = new THREE.Mesh(new THREE.PlaneGeometry(NICHE_DEPTH, WALL_HEIGHT), material);
    right.rotation.y = -Math.PI / 2;
    right.position.set(TILE_SIZE / 2, 0, -NICHE_DEPTH / 2);

    // Shelf at reach height — alcove items present at eye level, not on the floor.
    const shelf = new THREE.Mesh(new THREE.PlaneGeometry(TILE_SIZE, NICHE_DEPTH), material);
    shelf.rotation.x = -Math.PI / 2;
    shelf.position.set(0, SHELF_LOCAL_Y, -NICHE_DEPTH / 2);
    shelf.userData.entityId = alcoveId;
    shelf.userData.entityKind = "alcove" satisfies EntityKind;

    group.add(back, top, bottom, left, right, shelf);
    view.niche = group;
    this.interactiveGroup.add(group);
  }

  /**
   * Alcove items get the same flat-ground-plane treatment as floor items
   * (docs/ROADMAP.md M0.11) — a quad lying on the shelf's own horizontal
   * plane in the niche's locally-rotated frame, not a camera-facing sprite,
   * so it reads as actually resting on the shelf from any viewing angle.
   */
  private reconcileAlcoveItems(view: AlcoveView, items: readonly AlcoveItem[]): void {
    const group = view.niche;
    if (!group) return;

    const seen = new Set<string>();
    items.forEach((item, i) => {
      seen.add(item.id);
      let mesh = view.itemMeshes.get(item.id);
      if (!mesh) {
        const geometry = new THREE.PlaneGeometry(1, 1);
        geometry.rotateX(-Math.PI / 2);
        mesh = new THREE.Mesh(
          geometry,
          new THREE.MeshStandardMaterial({
            map: this.itemTextures[item.type] ?? null,
            transparent: true,
            roughness: 0.9,
          }),
        );
        const scale = itemVisualScale(item.type);
        mesh.scale.set(scale, 1, scale);
        mesh.rotation.y = (stringHash(item.id) % 360) * (Math.PI / 180);
        mesh.userData.entityId = item.id;
        mesh.userData.entityKind = "alcove-item" satisfies EntityKind;
        view.itemMeshes.set(item.id, mesh);
        group.add(mesh);
      }
      // Spread along the shelf at reach height.
      mesh.position.set(
        (i - (items.length - 1) / 2) * 0.7,
        SHELF_LOCAL_Y + ALCOVE_ITEM_Y_OFFSET,
        -NICHE_DEPTH * 0.55,
      );
    });

    for (const [id, mesh] of view.itemMeshes) {
      if (seen.has(id)) continue;
      group.remove(mesh);
      view.itemMeshes.delete(id);
    }
  }

  private buildOverlay(
    featureId: string,
    kind: EntityKind,
    face: BoundaryFace,
    texture: THREE.Texture,
    width: number,
    height: number,
  ): THREE.Mesh {
    const group = faceGroupAt(face);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
    mesh.position.z = OVERLAY_OFFSET;
    mesh.userData.entityId = featureId;
    mesh.userData.entityKind = kind;
    group.add(mesh);
    this.interactiveGroup.add(group);
    return mesh;
  }

  private buildPlaque(featureId: string, face: BoundaryFace): THREE.Object3D {
    const group = faceGroupAt(face);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x26282d, roughness: 0.8 }),
    );
    // Centered on eye height: the F-key's center-screen ray (pitched down 12°)
    // lands ~1.17 world units up at reading distance — a plaque raised +0.2
    // starts at 1.2 and the ray misses it entirely (found via Playwright).
    mesh.position.set(0, 0, OVERLAY_OFFSET);
    mesh.userData.entityId = featureId;
    mesh.userData.entityKind = "inscription" satisfies EntityKind;
    group.add(mesh);
    return group;
  }
}

/**
 * The boundary face for a wall feature at floor cell (x, z) facing `face` —
 * mirrors buildLevel's face math for features whose wall face stays instanced.
 */
function boundaryFor(x: number, z: number, face: string): BoundaryFace {
  const deltas: Record<string, { dx: number; dz: number; rotationY: number }> = {
    N: { dx: 0, dz: -1, rotationY: 0 },
    S: { dx: 0, dz: 1, rotationY: Math.PI },
    E: { dx: 1, dz: 0, rotationY: -Math.PI / 2 },
    W: { dx: -1, dz: 0, rotationY: Math.PI / 2 },
  };
  const d = deltas[face] ?? deltas.N!;
  return {
    position: new THREE.Vector3(
      x * TILE_SIZE + TILE_SIZE / 2 + (d.dx * TILE_SIZE) / 2,
      WALL_HEIGHT / 2,
      z * TILE_SIZE + TILE_SIZE / 2 + (d.dz * TILE_SIZE) / 2,
    ),
    rotationY: d.rotationY,
    wallCellX: x + d.dx,
    wallCellZ: z + d.dz,
  };
}
