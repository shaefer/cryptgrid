import * as THREE from "three";
import {
  createInitialState,
  parseLevel,
  validateLevel,
  type Facing,
  type LevelJSON,
} from "@cryptgrid/sim";
import { buildLevel, worldX, worldZ } from "./scene/buildLevel";
import { loadDungeonTextures } from "./scene/textures";

const FOG_COLOR = 0x0d0e12;
const CAMERA_HEIGHT = 1.6;

// World forward at rotationY=0 is -Z (Three.js default), which is our "N"
// (LEVELS.md: "North = −z"). The rest follow from rotating toward each facing.
const FACING_Y_ROTATION: Record<Facing, number> = {
  N: 0,
  E: -Math.PI / 2,
  S: Math.PI,
  W: Math.PI / 2,
};

async function main(): Promise<void> {
  const app = document.getElementById("app");
  const hud = document.getElementById("hud");
  if (!app || !hud) throw new Error("expected #app and #hud in index.html");

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 4, 18);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  scene.add(camera); // camera must be in the scene graph for its child torch light to affect it

  scene.add(new THREE.AmbientLight(0x404050, 0.6));
  const torch = new THREE.PointLight(0xffb46b, 60, 20, 1.8);
  camera.add(torch);

  const [levelJson, textures] = await Promise.all([
    fetch("/levels/vault01.json").then((res) => res.json() as Promise<LevelJSON>),
    loadDungeonTextures(),
  ]);

  const errors = validateLevel(levelJson);
  if (errors.length > 0) {
    console.error("vault01.json failed validation:", errors);
  }

  const level = parseLevel(levelJson);
  const state = createInitialState(level, 1);
  buildLevel(scene, level, textures);

  camera.position.set(worldX(state.party.x), CAMERA_HEIGHT, worldZ(state.party.z));
  camera.rotation.set(0, FACING_Y_ROTATION[state.party.facing], 0);

  hud.textContent = `${level.name} — party at (${state.party.x},${state.party.z}) facing ${state.party.facing}`;

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime();
    torch.intensity = 60 + Math.sin(t * 7.3) * 4 + Math.sin(t * 13.1) * 3;
    renderer.render(scene, camera);
    document.body.dataset.ready = "true";
  });
}

main().catch((err: unknown) => {
  console.error(err);
});
