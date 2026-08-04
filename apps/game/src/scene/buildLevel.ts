import * as THREE from "three";
import { cellCharAt as simCellCharAt, type LevelRuntime } from "@cryptgrid/sim";
import type { DungeonTextures } from "./textures";

export const TILE_SIZE = 3;
export const WALL_HEIGHT = 3;

export function worldX(x: number): number {
  return x * TILE_SIZE + TILE_SIZE / 2;
}

export function worldZ(z: number): number {
  return z * TILE_SIZE + TILE_SIZE / 2;
}

// 'X' (void, out of bounds) reads the same as a wall — LEVELS.md treats them identically.
function cellCharAt(level: LevelRuntime, x: number, z: number): string {
  return simCellCharAt(level, x, z) ?? "X";
}

function isSolid(ch: string): boolean {
  return ch === "#" || ch === "X" || ch === "D" || ch === "S";
}

interface FaceInstance {
  position: THREE.Vector3;
  rotationY: number;
}

// Each entry: neighbor offset + the Y rotation that turns a default (normal +Z)
// plane into a quad facing back into the floor cell from that boundary.
const WALL_NEIGHBORS: { dx: number; dz: number; rotationY: number }[] = [
  { dx: 0, dz: -1, rotationY: 0 }, // north boundary
  { dx: 0, dz: 1, rotationY: Math.PI }, // south boundary
  { dx: 1, dz: 0, rotationY: -Math.PI / 2 }, // east boundary
  { dx: -1, dz: 0, rotationY: Math.PI / 2 }, // west boundary
];

/**
 * Builds instanced wall-face, floor, and ceiling meshes from level data —
 * geometry from data, nothing hand-placed (ARCHITECTURE.md). Closed doors
 * (portcullis/secret) render as solid boundary faces for now; the sliding
 * open/close animation arrives with the interaction system in M0.8.
 */
export function buildLevel(scene: THREE.Scene, level: LevelRuntime, textures: DungeonTextures): void {
  const wallFaces: FaceInstance[] = [];
  const portcullisFaces: FaceInstance[] = [];
  const secretFaces: FaceInstance[] = [];
  const floorCells: { x: number; z: number }[] = [];

  for (let z = 0; z < level.height; z++) {
    for (let x = 0; x < level.width; x++) {
      if (cellCharAt(level, x, z) !== ".") continue;
      floorCells.push({ x, z });

      const cx = worldX(x);
      const cz = worldZ(z);
      for (const { dx, dz, rotationY } of WALL_NEIGHBORS) {
        const neighbor = cellCharAt(level, x + dx, z + dz);
        if (!isSolid(neighbor)) continue;

        const position = new THREE.Vector3(
          cx + (dx * TILE_SIZE) / 2,
          WALL_HEIGHT / 2,
          cz + (dz * TILE_SIZE) / 2,
        );
        const face: FaceInstance = { position, rotationY };
        const bucket = neighbor === "D" ? portcullisFaces : neighbor === "S" ? secretFaces : wallFaces;
        bucket.push(face);
      }
    }
  }

  addFaceMesh(scene, wallFaces, textures.wall, false);
  addFaceMesh(scene, portcullisFaces, textures.doorPortcullis, true);
  addFaceMesh(scene, secretFaces, textures.doorSecret, false);
  addFloorAndCeiling(scene, floorCells, textures);
}

function addFaceMesh(
  scene: THREE.Scene,
  faces: FaceInstance[],
  texture: THREE.Texture,
  transparent: boolean,
): void {
  if (faces.length === 0) return;

  const geometry = new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT);
  const material = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.95, transparent });
  const mesh = new THREE.InstancedMesh(geometry, material, faces.length);

  const dummy = new THREE.Object3D();
  faces.forEach((face, i) => {
    dummy.position.copy(face.position);
    dummy.rotation.set(0, face.rotationY, 0);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  scene.add(mesh);
}

function addFloorAndCeiling(
  scene: THREE.Scene,
  floorCells: { x: number; z: number }[],
  textures: DungeonTextures,
): void {
  if (floorCells.length === 0) return;

  const floorGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  floorGeo.rotateX(-Math.PI / 2);
  const floorMat = new THREE.MeshStandardMaterial({ map: textures.floor, roughness: 1 });
  const floorMesh = new THREE.InstancedMesh(floorGeo, floorMat, floorCells.length);

  const ceilGeo = new THREE.PlaneGeometry(TILE_SIZE, TILE_SIZE);
  ceilGeo.rotateX(Math.PI / 2);
  const ceilMat = new THREE.MeshStandardMaterial({ map: textures.ceiling, roughness: 1 });
  const ceilMesh = new THREE.InstancedMesh(ceilGeo, ceilMat, floorCells.length);

  const dummy = new THREE.Object3D();
  floorCells.forEach((cell, i) => {
    const cx = worldX(cell.x);
    const cz = worldZ(cell.z);

    dummy.position.set(cx, 0, cz);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    floorMesh.setMatrixAt(i, dummy.matrix);

    dummy.position.set(cx, WALL_HEIGHT, cz);
    dummy.updateMatrix();
    ceilMesh.setMatrixAt(i, dummy.matrix);
  });
  floorMesh.instanceMatrix.needsUpdate = true;
  ceilMesh.instanceMatrix.needsUpdate = true;
  scene.add(floorMesh, ceilMesh);
}
