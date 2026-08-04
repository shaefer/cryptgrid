import * as THREE from "three";
import { ITEM_REGISTRY } from "@cryptgrid/sim";

/** One sprite texture per registered item type (docs/ASSETS.md item sprites), keyed by ItemType.id. */
export type ItemTextures = Record<string, THREE.Texture>;

export async function loadItemTextures(): Promise<ItemTextures> {
  const loader = new THREE.TextureLoader();
  const ids = Object.keys(ITEM_REGISTRY);

  const textures = await Promise.all(
    ids.map(async (id) => {
      // BASE_URL keeps these working both at "/" in dev and "/cryptgrid/" on Pages.
      const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/items/${id}.png`);
      tex.colorSpace = THREE.SRGBColorSpace;
      return [id, tex] as const;
    }),
  );

  return Object.fromEntries(textures);
}
