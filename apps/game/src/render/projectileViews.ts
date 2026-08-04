import * as THREE from "three";
import type { SimEvent } from "@cryptgrid/sim";
import { TILE_SIZE, worldX, worldZ } from "../scene/buildLevel";

const FLIGHT_HEIGHT = 1.4;
/** Matches the sim's 1-tile-per-2-ticks cadence (200ms at 10Hz) so flight looks continuous. */
const MOVE_TWEEN_MS = 200;
const IMPACT_FLASH_MS = 180;

interface View {
  group: THREE.Group;
  light: THREE.PointLight;
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  tweenStartMs: number;
  /** Set on wall impact — flash bright, then remove. */
  impactAtMs: number | null;
}

/**
 * Firebolt rendering (ROADMAP.md M0.9's "money moment"): a glowing projectile
 * with a parented point light so it lights the walls as it passes, driven
 * purely by sim events — spawn, per-tile moves, and a wall-impact flash.
 */
export class ProjectileViews {
  private readonly views = new Map<number, View>();

  constructor(private readonly scene: THREE.Scene) {}

  handleEvent(event: SimEvent, nowMs: number): void {
    if (event.type === "ProjectileSpawned") {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 12, 12),
        new THREE.MeshBasicMaterial({ color: 0xffb04a }),
      );
      const light = new THREE.PointLight(0xff8a2a, 40, 10, 1.6);
      group.add(core, light);
      group.position.set(worldX(event.x), FLIGHT_HEIGHT, worldZ(event.z));
      this.scene.add(group);
      this.views.set(event.id, {
        group,
        light,
        fromX: event.x,
        fromZ: event.z,
        toX: event.x,
        toZ: event.z,
        tweenStartMs: nowMs,
        impactAtMs: null,
      });
      return;
    }

    if (event.type !== "ProjectileMoved" && event.type !== "ProjectileHitWall") return;
    const view = this.views.get(event.id);
    if (!view) return;

    if (event.type === "ProjectileMoved") {
      view.fromX = view.toX;
      view.fromZ = view.toZ;
      view.toX = event.x;
      view.toZ = event.z;
      view.tweenStartMs = nowMs;
    } else if (event.type === "ProjectileHitWall") {
      // Impact cell is the wall itself — flash at the boundary in front of it.
      view.fromX = view.toX;
      view.fromZ = view.toZ;
      view.toX = (view.toX + event.x) / 2;
      view.toZ = (view.toZ + event.z) / 2;
      view.tweenStartMs = nowMs;
      view.impactAtMs = nowMs;
      view.light.intensity = 140; // the flash
    }
  }

  update(nowMs: number): void {
    for (const [id, view] of this.views) {
      const t = Math.min(1, (nowMs - view.tweenStartMs) / MOVE_TWEEN_MS);
      // worldX/worldZ for fractional tile coordinates.
      const x = (view.fromX + (view.toX - view.fromX) * t) * TILE_SIZE + TILE_SIZE / 2;
      const z = (view.fromZ + (view.toZ - view.fromZ) * t) * TILE_SIZE + TILE_SIZE / 2;
      view.group.position.set(x, FLIGHT_HEIGHT, z);

      if (view.impactAtMs !== null && nowMs - view.impactAtMs >= IMPACT_FLASH_MS) {
        this.scene.remove(view.group);
        this.views.delete(id);
      }
    }
  }
}
