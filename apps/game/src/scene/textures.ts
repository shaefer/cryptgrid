import * as THREE from "three";

export interface DungeonTextures {
  wall: THREE.Texture;
  floor: THREE.Texture;
  ceiling: THREE.Texture;
  doorPortcullis: THREE.Texture;
  doorSecret: THREE.Texture;
}

export async function loadDungeonTextures(): Promise<DungeonTextures> {
  const loader = new THREE.TextureLoader();

  const load = async (name: string): Promise<THREE.Texture> => {
    const tex = await loader.loadAsync(`/assets/textures/${name}.png`);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  };

  const [wall, floor, ceiling, doorPortcullis, doorSecret] = await Promise.all([
    load("wall_stone"),
    load("floor_stone"),
    load("ceiling_stone"),
    load("door_portcullis"),
    load("door_secret"),
  ]);

  return { wall, floor, ceiling, doorPortcullis, doorSecret };
}
