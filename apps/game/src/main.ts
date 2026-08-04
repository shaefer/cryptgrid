import * as THREE from "three";
import { SIM_VERSION, TICKS_PER_SECOND } from "@cryptgrid/sim";

// M0.1 scaffold scene: proves the vite + three + workspace-sim pipeline.
// Real level rendering arrives in M0.3 (instanced walls/floor/ceiling from level JSON).

const FOG_COLOR = 0x0d0e12;

const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(FOG_COLOR);
scene.fog = new THREE.Fog(FOG_COLOR, 4, 18);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.6, 6);

scene.add(new THREE.AmbientLight(0x404050, 0.4));
const torch = new THREE.PointLight(0xffb46b, 40, 20, 1.8);
torch.position.copy(camera.position);
scene.add(torch);

const block = new THREE.Mesh(
  new THREE.BoxGeometry(1.5, 1.5, 1.5),
  new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.9 }),
);
block.position.set(0, 1.5, 0);
scene.add(block);

const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(30, 30),
  new THREE.MeshStandardMaterial({ color: 0x4a4e55, roughness: 1 }),
);
floor.rotation.x = -Math.PI / 2;
scene.add(floor);

const hud = document.getElementById("hud")!;
hud.textContent = `CRYPTGRID — scaffold · sim v${SIM_VERSION} @ ${TICKS_PER_SECOND}Hz`;

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  const t = clock.getElapsedTime();
  block.rotation.y = t * 0.5;
  torch.intensity = 40 + Math.sin(t * 7.3) * 3 + Math.sin(t * 13.1) * 2;
  renderer.render(scene, camera);
  document.body.dataset.ready = "true";
});
