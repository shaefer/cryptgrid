import type * as THREE from "three";
import type { Facing, PartyState, SimEvent } from "@cryptgrid/sim";
import { worldX, worldZ } from "../scene/buildLevel";
import {
  BUMP_DISTANCE,
  BUMP_MS,
  CAMERA_HEIGHT,
  MOVE_TWEEN_MS,
  TURN_TWEEN_MS,
  ease,
} from "../tuning";

const TWO_PI = Math.PI * 2;

// World forward at rotationY = 0 is -Z (Three.js default), which is our "N"
// (LEVELS.md: "North = -z"). The rest follow by rotating toward each facing.
const FACING_Y_ROTATION: Record<Facing, number> = {
  N: 0,
  E: -Math.PI / 2,
  S: Math.PI,
  W: Math.PI / 2,
};

interface Tween {
  from: number;
  to: number;
  startMs: number;
  durationMs: number;
}

function sample(tween: Tween, nowMs: number): { value: number; done: boolean } {
  const elapsed = nowMs - tween.startMs;
  if (elapsed >= tween.durationMs) return { value: tween.to, done: true };
  const t = ease(elapsed / tween.durationMs);
  return { value: tween.from + (tween.to - tween.from) * t, done: false };
}

/**
 * Drives the camera from sim events. The sim resolves movement discretely; this
 * animates toward each resolved position so the grid stays authoritative while
 * the view stays smooth (ARCHITECTURE.md: "visual positions tween toward sim
 * positions"). In multiplayer this same class becomes client prediction — it
 * already only ever reacts to events, never to input.
 */
export class PartyView {
  private x: number;
  private z: number;
  private moveX: Tween | null = null;
  private moveZ: Tween | null = null;

  /**
   * Continuous, not wrapped to [-PI, PI]: turning is always applied as a
   * relative delta to whatever the camera currently reads. Tweening between
   * absolute facing angles would spin the long way around at the N/S seam
   * (e.g. E -> S would sweep 270 degrees instead of 90).
   */
  private rotationY: number;
  private turn: Tween | null = null;

  private bumpDirX = 0;
  private bumpDirZ = 0;
  private bump: Tween | null = null;

  constructor(
    private readonly camera: THREE.PerspectiveCamera,
    party: PartyState,
  ) {
    this.x = worldX(party.x);
    this.z = worldZ(party.z);
    this.rotationY = FACING_Y_ROTATION[party.facing];
    this.applyToCamera(0, 0);
  }

  handleEvent(event: SimEvent, nowMs: number): void {
    switch (event.type) {
      case "PartyMoved": {
        // Tween from the live visual position, not the previous grid cell, so an
        // event arriving mid-tween continues smoothly instead of snapping back.
        this.moveX = {
          from: this.x,
          to: worldX(event.x),
          startMs: nowMs,
          durationMs: MOVE_TWEEN_MS,
        };
        this.moveZ = {
          from: this.z,
          to: worldZ(event.z),
          startMs: nowMs,
          durationMs: MOVE_TWEEN_MS,
        };
        break;
      }
      case "PartyTurned": {
        this.turn = {
          from: this.rotationY,
          to: this.nearestAngleFor(event.facing),
          startMs: nowMs,
          durationMs: TURN_TWEEN_MS,
        };
        break;
      }
      case "PartyBumped": {
        // Lurch toward the blocked tile and back — reads as hitting something
        // solid rather than as input being ignored.
        const dx = worldX(event.x) - this.x;
        const dz = worldZ(event.z) - this.z;
        const length = Math.hypot(dx, dz) || 1;
        this.bumpDirX = dx / length;
        this.bumpDirZ = dz / length;
        this.bump = { from: 0, to: 1, startMs: nowMs, durationMs: BUMP_MS };
        break;
      }
    }
  }

  update(nowMs: number): void {
    if (this.moveX) {
      const { value, done } = sample(this.moveX, nowMs);
      this.x = value;
      if (done) this.moveX = null;
    }
    if (this.moveZ) {
      const { value, done } = sample(this.moveZ, nowMs);
      this.z = value;
      if (done) this.moveZ = null;
    }
    if (this.turn) {
      const { value, done } = sample(this.turn, nowMs);
      this.rotationY = value;
      if (done) this.turn = null;
    }

    let bumpOffset = 0;
    if (this.bump) {
      const elapsed = nowMs - this.bump.startMs;
      if (elapsed >= this.bump.durationMs) {
        this.bump = null;
      } else {
        // sin goes 0 -> 1 -> 0 across the tween: out and back in one curve.
        bumpOffset = Math.sin((elapsed / this.bump.durationMs) * Math.PI) * BUMP_DISTANCE;
      }
    }

    this.applyToCamera(this.bumpDirX * bumpOffset, this.bumpDirZ * bumpOffset);
  }

  /** True while anything is still animating — used by the smoke test to wait for a settled frame. */
  isIdle(): boolean {
    return !this.moveX && !this.moveZ && !this.turn && !this.bump;
  }

  private applyToCamera(offsetX: number, offsetZ: number): void {
    this.camera.position.set(this.x + offsetX, CAMERA_HEIGHT, this.z + offsetZ);
    this.camera.rotation.set(0, this.rotationY, 0);
  }

  /**
   * The representation of `facing` closest to the camera's current angle, so a
   * 90-degree turn always animates 90 degrees in the intended direction.
   */
  private nearestAngleFor(facing: Facing): number {
    const base = FACING_Y_ROTATION[facing];
    const turns = Math.round((this.rotationY - base) / TWO_PI);
    return base + turns * TWO_PI;
  }
}
