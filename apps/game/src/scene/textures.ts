import * as THREE from "three";
import type { WallVariantId } from "@cryptgrid/sim";

/** One wall look + its own secret-tell variants — never mix tells across looks (ASSETS.md). */
export interface WallVariant {
  base: THREE.Texture;
  /** A switch deterministically picks one by its own id (packages/sim stringHash). Empty for transition variants. */
  secretTells: THREE.Texture[];
}

export interface DungeonTextures {
  /** Keyed by the sim's WallVariantId — resolveWallVariant() picks which entry applies per cell. */
  wallVariants: Record<WallVariantId, WallVariant>;
  alcoveBack: THREE.Texture;
  floor: THREE.Texture;
  ceiling: THREE.Texture;
  doorPortcullis: THREE.Texture;
  doorSecret: THREE.Texture;
  featureSwitch: THREE.Texture;
  featureLever: THREE.Texture;
  featureLeverOn: THREE.Texture;
}

export async function loadDungeonTextures(): Promise<DungeonTextures> {
  const loader = new THREE.TextureLoader();

  const load = async (name: string): Promise<THREE.Texture> => {
    // BASE_URL keeps these working both at "/" in dev and "/cryptgrid/" on Pages.
    const tex = await loader.loadAsync(`${import.meta.env.BASE_URL}assets/textures/${name}.png`);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const [
    wallStone,
    wallStoneConspicuous,
    wallStoneSubtle,
    wallFieldstone,
    wallFieldstoneConspicuous,
    wallFieldstoneSubtle,
    wallThinbrick,
    wallThinbrickConspicuous,
    wallThinbrickSubtle,
    wallStoneFieldstone,
    wallStoneThinbrick,
    wallFieldstoneThinbrick,
    alcoveBack,
    floor,
    ceiling,
    doorPortcullis,
    doorSecret,
    featureSwitch,
    featureLever,
    featureLeverOn,
  ] = await Promise.all([
    load("wall_stone"),
    load("wall_stone_secret_conspicuous"),
    load("wall_stone_secret_subtle"),
    load("wall_fieldstone"),
    load("wall_fieldstone_secret_conspicuous"),
    load("wall_fieldstone_secret_subtle"),
    load("wall_thinbrick"),
    load("wall_thinbrick_secret_conspicuous"),
    load("wall_thinbrick_secret_subtle"),
    load("wall_stone-fieldstone"),
    load("wall_stone-thinbrick"),
    load("wall_fieldstone-thinbrick"),
    load("wall_alcove_back"),
    load("floor_stone"),
    load("ceiling_stone"),
    load("door_portcullis"),
    load("door_secret"),
    load("feature_switch"),
    load("feature_lever"),
    load("feature_lever_on"),
  ]);

  return {
    wallVariants: {
      stone: { base: wallStone, secretTells: [wallStoneConspicuous, wallStoneSubtle] },
      fieldstone: { base: wallFieldstone, secretTells: [wallFieldstoneConspicuous, wallFieldstoneSubtle] },
      thinbrick: { base: wallThinbrick, secretTells: [wallThinbrickConspicuous, wallThinbrickSubtle] },
      "stone-fieldstone": { base: wallStoneFieldstone, secretTells: [] },
      "stone-thinbrick": { base: wallStoneThinbrick, secretTells: [] },
      "fieldstone-thinbrick": { base: wallFieldstoneThinbrick, secretTells: [] },
    },
    alcoveBack,
    floor,
    ceiling,
    doorPortcullis,
    doorSecret,
    featureSwitch,
    featureLever,
    featureLeverOn,
  };
}
