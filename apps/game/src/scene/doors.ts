import * as THREE from "three";
import type { LevelRuntime, SimEvent } from "@cryptgrid/sim";
import { TILE_SIZE, WALL_HEIGHT, type BoundaryFace } from "./buildLevel";
import { ease } from "../tuning";
import type { DungeonTextures } from "./textures";

/** How far a door slides up when open — most of its height, leaving a visible lintel sliver. */
const OPEN_RISE = WALL_HEIGHT * 0.92;
const SLIDE_MS = 600;

interface Slide {
  fromY: number;
  toY: number;
  startMs: number;
}

/**
 * One THREE.Group per door, holding every boundary face of that door's cell,
 * sliding up/down in reaction to DoorOpened/DoorClosed events (ROADMAP.md
 * M0.8 — collision already respected `door.open`; this is the visual half it
 * never had). The sim stays authoritative: this only ever reacts to events.
 */
export class DoorViews {
  private readonly groups = new Map<string, THREE.Group>();
  private readonly slides = new Map<string, Slide>();

  constructor(
    scene: THREE.Scene,
    level: LevelRuntime,
    textures: DungeonTextures,
    doorFaces: Map<string, BoundaryFace[]>,
  ) {
    for (const door of level.doors) {
      const faces = doorFaces.get(door.id);
      if (!faces || faces.length === 0) continue;

      const group = new THREE.Group();
      const texture = door.type === "portcullis" ? textures.doorPortcullis : textures.doorSecret;
      const geometry = new THREE.PlaneGeometry(TILE_SIZE, WALL_HEIGHT);
      const material = new THREE.MeshStandardMaterial({
        map: texture,
        roughness: 0.95,
        transparent: door.type === "portcullis",
      });

      for (const face of faces) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(face.position);
        mesh.rotation.set(0, face.rotationY, 0);
        mesh.userData.entityId = door.id;
        mesh.userData.entityKind = "door";
        group.add(mesh);
      }

      if (door.open) group.position.y = OPEN_RISE; // authored-open doors start raised
      this.groups.set(door.id, group);
      scene.add(group);
    }
  }

  handleEvent(event: SimEvent, nowMs: number): void {
    if (event.type !== "DoorOpened" && event.type !== "DoorClosed") return;
    const group = this.groups.get(event.doorId);
    if (!group) return;
    this.slides.set(event.doorId, {
      fromY: group.position.y,
      toY: event.type === "DoorOpened" ? OPEN_RISE : 0,
      startMs: nowMs,
    });
  }

  update(nowMs: number): void {
    for (const [doorId, slide] of this.slides) {
      const group = this.groups.get(doorId);
      if (!group) {
        this.slides.delete(doorId);
        continue;
      }
      const t = (nowMs - slide.startMs) / SLIDE_MS;
      if (t >= 1) {
        group.position.y = slide.toY;
        this.slides.delete(doorId);
      } else {
        group.position.y = slide.fromY + (slide.toY - slide.fromY) * ease(t);
      }
    }
  }
}
