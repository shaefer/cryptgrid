import * as THREE from "three";

/** One wall look + its matching secret-switch tell — never mix pairs across looks (ASSETS.md). */
export interface WallVariant {
  base: THREE.Texture;
  secretSwitch: THREE.Texture;
}

export interface DungeonTextures {
  /** Indexed by the sim's wallVariantIndex(cellX, cellZ, wallVariants.length). */
  wallVariants: WallVariant[];
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
    wallStoneSecret,
    wallFieldstone,
    wallFieldstoneSecret,
    wallHewn,
    wallHewnSecret,
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
    load("wall_stone_secretbrick"),
    load("wall_fieldstone"),
    load("wall_fieldstone_secretbrick"),
    load("wall_hewn"),
    load("wall_hewn_secretbrick"),
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
    wallVariants: [
      { base: wallStone, secretSwitch: wallStoneSecret },
      { base: wallFieldstone, secretSwitch: wallFieldstoneSecret },
      { base: wallHewn, secretSwitch: wallHewnSecret },
    ],
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
