import * as THREE from "three";
import { stringHash, type ItemSlot, type LevelItem } from "@cryptgrid/sim";
import { TILE_SIZE, worldX, worldZ } from "./buildLevel";
import { itemVisualScale } from "./itemVisuals";
import type { ItemTextures } from "./itemTextures";

/** Just above the floor plane — avoids z-fighting without floating visibly. */
const ITEM_Y = 0.015;

/** Hover glow (docs/ROADMAP.md M0.11): a tinted copy of the item's own quad, larger and just beneath it. */
const GLOW_SCALE = 1.18;
const GLOW_Y_OFFSET = -0.005;
const GLOW_COLOR = 0x6fb8ff;
const GLOW_OPACITY = 0.55;

// Offsets from tile center for the 4 quadrant slots (docs/LEVELS.md). North is
// -z (LEVELS.md convention), so "ne" moves +x/-z, "sw" moves -x/+z, etc. —
// mirrors apps/game/src/tuning.ts's CAMERA_PITCH_DEG comment, which already
// assumed this exact +-0.75 (TILE_SIZE/4) offset.
const SLOT_OFFSET: Record<ItemSlot, { dx: number; dz: number }> = {
  center: { dx: 0, dz: 0 },
  ne: { dx: TILE_SIZE / 4, dz: -TILE_SIZE / 4 },
  se: { dx: TILE_SIZE / 4, dz: TILE_SIZE / 4 },
  nw: { dx: -TILE_SIZE / 4, dz: -TILE_SIZE / 4 },
  sw: { dx: -TILE_SIZE / 4, dz: TILE_SIZE / 4 },
};

/**
 * Renders one flat ground-plane quad per floor item, reconciled against the
 * live (shrinking-as-items-get-picked-up) `level.items` list each tick —
 * same add/remove-by-id pattern as hud/vitalsHud.ts's CharacterBlock map.
 * Flat geometry (not a billboard sprite) gets correct perspective
 * foreshortening from any viewing angle for free, the same way the floor
 * texture does — this is what actually grounds the item (docs/ROADMAP.md
 * M0.11); a camera-facing sprite could never read as sitting on the floor
 * regardless of shading quality. Each quad is tagged `userData.entityId`
 * (ARCHITECTURE.md's raycast idiom) so InteractionInput can resolve a click
 * or center-screen ray to an item id.
 */
export class ItemSprites {
  /** Raycast against `.children` — every quad carries entityId + entityKind "item". */
  readonly group = new THREE.Group();
  private readonly meshes = new Map<string, THREE.Mesh>();
  private hoveredId: string | null = null;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly textures: ItemTextures,
  ) {
    this.scene.add(this.group);
  }

  update(items: readonly LevelItem[]): void {
    const seen = new Set<string>();

    for (const item of items) {
      seen.add(item.id);
      let mesh = this.meshes.get(item.id);
      if (!mesh) {
        mesh = this.createMesh(item);
        this.meshes.set(item.id, mesh);
        this.group.add(mesh);
      }
      this.positionMesh(mesh, item);
    }

    for (const [id, mesh] of this.meshes) {
      if (seen.has(id)) continue;
      this.group.remove(mesh);
      this.meshes.delete(id);
    }
  }

  /**
   * Toggles the light-blue hover glow on at most one item at a time — the
   * hover highlighter (render/hoverHighlighter.ts) calls this once per frame
   * with whichever in-range item the reticle is currently over, or null.
   */
  setHovered(itemId: string | null): void {
    if (itemId === this.hoveredId) return;
    const previous = this.hoveredId ? this.meshes.get(this.hoveredId) : undefined;
    if (previous) (previous.userData.glow as THREE.Mesh).visible = false;
    const next = itemId ? this.meshes.get(itemId) : undefined;
    if (next) (next.userData.glow as THREE.Mesh).visible = true;
    this.hoveredId = itemId;
  }

  private createMesh(item: LevelItem): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshStandardMaterial({
      map: this.textures[item.type] ?? null,
      transparent: true,
      roughness: 0.9,
    });
    const mesh = new THREE.Mesh(geometry, material);
    const scale = itemVisualScale(item.type);
    mesh.scale.set(scale, 1, scale);
    // Deterministic per-item facing so same-type items scattered around a
    // level don't all read as identically oriented.
    mesh.rotation.y = (stringHash(item.id) % 360) * (Math.PI / 180);
    mesh.userData.entityId = item.id;
    mesh.userData.entityKind = "item";
    mesh.userData.glow = this.createGlow(item);
    mesh.add(mesh.userData.glow as THREE.Mesh);
    return mesh;
  }

  /** Same silhouette as the item (shares its texture), tinted and enlarged, hidden until hovered. */
  private createGlow(item: LevelItem): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(1, 1);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      map: this.textures[item.type] ?? null,
      color: GLOW_COLOR,
      transparent: true,
      opacity: GLOW_OPACITY,
      depthWrite: false,
    });
    const glow = new THREE.Mesh(geometry, material);
    glow.scale.set(GLOW_SCALE, 1, GLOW_SCALE);
    glow.position.set(0, GLOW_Y_OFFSET, 0);
    glow.visible = false;
    return glow;
  }

  private positionMesh(mesh: THREE.Mesh, item: LevelItem): void {
    const { dx, dz } = SLOT_OFFSET[item.slot ?? "center"];
    mesh.position.set(worldX(item.x) + dx, ITEM_Y, worldZ(item.z) + dz);
  }
}
