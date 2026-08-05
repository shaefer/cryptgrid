import * as THREE from "three";
import {
  cellCharAt as simCellCharAt,
  findDoorAt,
  resolveWallVariant,
  WALL_VARIANT_IDS,
  type Facing,
  type LevelRuntime,
  type WallVariantId,
} from "@cryptgrid/sim";
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

/** One wall-boundary face: where it sits, how it's turned, and which wall cell owns it. */
export interface BoundaryFace {
  position: THREE.Vector3;
  rotationY: number;
  wallCellX: number;
  wallCellZ: number;
}

/**
 * The non-instanced leftovers of a build — boundary faces that something else
 * animates or swaps at runtime, handed to DoorViews / FeatureViews instead of
 * being baked into the static instanced meshes.
 */
export interface BuildResult {
  /** Every face of each door cell, keyed by door id — the unit that slides. */
  doorFaces: Map<string, BoundaryFace[]>;
  /** The face a secret switch or alcove occupies, keyed by feature id. */
  featureFaces: Map<string, BoundaryFace>;
}

// Each entry: neighbor offset + the Y rotation that turns a default (normal +Z)
// plane into a quad facing back into the floor cell from that boundary.
const WALL_NEIGHBORS: { dx: number; dz: number; rotationY: number; face: Facing }[] = [
  { dx: 0, dz: -1, rotationY: 0, face: "N" }, // north boundary
  { dx: 0, dz: 1, rotationY: Math.PI, face: "S" }, // south boundary
  { dx: 1, dz: 0, rotationY: -Math.PI / 2, face: "E" }, // east boundary
  { dx: -1, dz: 0, rotationY: Math.PI / 2, face: "W" }, // west boundary
];

/**
 * Builds instanced wall-face, floor, and ceiling meshes from level data —
 * geometry from data, nothing hand-placed (ARCHITECTURE.md). Wall texture
 * variant is picked per wall *cell* via the sim's stable hash, so every face
 * of one physical stone block agrees and the same level always renders
 * identically (ROADMAP.md M0.8). Door faces and secret-switch/alcove faces
 * are returned, not baked in — DoorViews slides the former, FeatureViews
 * dresses and swaps the latter.
 */
export function buildLevel(
  scene: THREE.Scene,
  level: LevelRuntime,
  textures: DungeonTextures,
): BuildResult {
  const variantFaces: Record<WallVariantId, BoundaryFace[]> = {
    stone: [],
    fieldstone: [],
    thinbrick: [],
    "stone-fieldstone": [],
    "stone-thinbrick": [],
    "fieldstone-thinbrick": [],
  };
  const doorFaces = new Map<string, BoundaryFace[]>();
  const featureFaces = new Map<string, BoundaryFace>();
  const floorCells: { x: number; z: number }[] = [];

  // Boundaries claimed by a secret switch or an alcove, keyed "x,z,face" of
  // the emitting floor cell — these skip the instanced meshes entirely.
  const claimed = new Map<string, string>();
  for (const feature of level.wallFeatures) {
    const isSecretSwitch = feature.type === "switch" && feature.variant === "secretBrick";
    if (isSecretSwitch || feature.type === "alcove") {
      claimed.set(`${feature.x},${feature.z},${feature.face}`, feature.id);
    }
  }

  for (let z = 0; z < level.height; z++) {
    for (let x = 0; x < level.width; x++) {
      const cell = cellCharAt(level, x, z);
      const isDoorCell = cell === "D" || cell === "S";
      // Door cells are walkable tunnels once open — they need floor, ceiling,
      // and side walls of their own, or an opened door reveals unrendered void
      // (found via Playwright screenshot the first time a door actually slid).
      if (cell !== "." && !isDoorCell) continue;
      floorCells.push({ x, z });

      const cx = worldX(x);
      const cz = worldZ(z);
      for (const { dx, dz, rotationY, face } of WALL_NEIGHBORS) {
        const nx = x + dx;
        const nz = z + dz;
        const neighbor = cellCharAt(level, nx, nz);
        if (!isSolid(neighbor)) continue;
        // From inside a door tunnel, only true walls get faces — the door
        // planes at the floor-cell boundaries are DoorViews' job.
        if (isDoorCell && (neighbor === "D" || neighbor === "S")) continue;

        const boundary: BoundaryFace = {
          position: new THREE.Vector3(cx + (dx * TILE_SIZE) / 2, WALL_HEIGHT / 2, cz + (dz * TILE_SIZE) / 2),
          rotationY,
          wallCellX: nx,
          wallCellZ: nz,
        };

        if (!isDoorCell && (neighbor === "D" || neighbor === "S")) {
          const door = findDoorAt(level, nx, nz);
          if (door) {
            const faces = doorFaces.get(door.id) ?? [];
            faces.push(boundary);
            doorFaces.set(door.id, faces);
            continue;
          }
        }

        const featureId = claimed.get(`${x},${z},${face}`);
        if (featureId) {
          featureFaces.set(featureId, boundary);
          continue;
        }

        variantFaces[resolveWallVariant(level, nx, nz)].push(boundary);
      }
    }
  }

  for (const id of WALL_VARIANT_IDS) {
    addFaceMesh(scene, variantFaces[id], textures.wallVariants[id].base, false);
  }
  addFloorAndCeiling(scene, floorCells, textures);

  return { doorFaces, featureFaces };
}

function addFaceMesh(
  scene: THREE.Scene,
  faces: BoundaryFace[],
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
