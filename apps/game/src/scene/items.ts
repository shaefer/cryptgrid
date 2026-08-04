import * as THREE from "three";
import type { ItemSlot, LevelItem } from "@cryptgrid/sim";
import { TILE_SIZE, worldX, worldZ } from "./buildLevel";
import type { ItemTextures } from "./itemTextures";

/** Floor items render as small billboards, not full tile-sized icons. */
const SPRITE_SIZE = 0.6;

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
 * Renders one billboard sprite per floor item, reconciled against the live
 * (shrinking-as-items-get-picked-up) `level.items` list each tick — same
 * add/remove-by-id pattern as hud/vitalsHud.ts's CharacterBlock map. Each
 * sprite is tagged `userData.entityId` (ARCHITECTURE.md's raycast idiom) so
 * InteractionInput can resolve a click or center-screen ray to an item id.
 */
export class ItemSprites {
  private readonly group = new THREE.Group();
  private readonly sprites = new Map<string, THREE.Sprite>();
  private readonly raycaster = new THREE.Raycaster();

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
      let sprite = this.sprites.get(item.id);
      if (!sprite) {
        sprite = this.createSprite(item);
        this.sprites.set(item.id, sprite);
        this.group.add(sprite);
      }
      this.positionSprite(sprite, item);
    }

    for (const [id, sprite] of this.sprites) {
      if (seen.has(id)) continue;
      this.group.remove(sprite);
      this.sprites.delete(id);
    }
  }

  /** Casts a ray from normalized device coords and returns the hit item's id, if any. */
  raycast(camera: THREE.Camera, ndcX: number, ndcY: number): string | null {
    this.raycaster.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hit = this.raycaster.intersectObjects(this.group.children, false)[0];
    return (hit?.object.userData.entityId as string | undefined) ?? null;
  }

  private createSprite(item: LevelItem): THREE.Sprite {
    const material = new THREE.SpriteMaterial({
      map: this.textures[item.type] ?? null,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(SPRITE_SIZE, SPRITE_SIZE, 1);
    sprite.userData.entityId = item.id;
    return sprite;
  }

  private positionSprite(sprite: THREE.Sprite, item: LevelItem): void {
    const { dx, dz } = SLOT_OFFSET[item.slot ?? "center"];
    sprite.position.set(worldX(item.x) + dx, SPRITE_SIZE / 2, worldZ(item.z) + dz);
  }
}
