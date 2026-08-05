import type { Facing } from "../facing";
import type { WallVariantId } from "../hash";

export type CellChar = "#" | "." | "D" | "S" | "X";

export interface LevelStart {
  x: number;
  z: number;
  facing: Facing;
}

export type DoorType = "portcullis" | "secret";

export interface LevelDoor {
  id: string;
  x: number;
  z: number;
  type: DoorType;
  open: boolean;
}

interface WallFeatureBase {
  id: string;
  x: number;
  z: number;
  face: Facing;
}

export type SwitchAction = "toggle" | "open" | "close";

export interface SwitchFeature extends WallFeatureBase {
  type: "switch";
  variant?: string;
  targets: string[];
  action: SwitchAction;
}

export interface LeverFeature extends WallFeatureBase {
  type: "lever";
  targets: string[];
  action: SwitchAction;
}

export interface AlcoveItem {
  id: string;
  type: string;
}

export interface AlcoveFeature extends WallFeatureBase {
  type: "alcove";
  // {id, type} rather than bare id strings: LEVELS.md's ["itm_torch_1"] example
  // doesn't say where the type comes from, so items stay self-contained here.
  items: AlcoveItem[];
  /**
   * Renders as plain wall (no tell of its own — only switches get one) until a
   * switch/lever targeting this id fires AlcoveRevealed. Omitted/false =
   * always-visible. Flipped to false in runtime state on reveal.
   */
  hidden?: boolean;
}

export interface InscriptionFeature extends WallFeatureBase {
  type: "inscription";
  text: string;
}

export type WallFeature = SwitchFeature | LeverFeature | AlcoveFeature | InscriptionFeature;

/**
 * Sub-tile position within a floor cell — up to 4 items can share one tile,
 * one per quadrant. No "center": a center-slotted item was unreachable from
 * any adjacent tile (always exactly 1 tile from a neighbor's own center,
 * outside PICKUP_RANGE_TILES) and invisible/off-camera while standing on it
 * (docs/ROADMAP.md M0.11's own CAMERA_PITCH_DEG note) — every quadrant, by
 * contrast, has a near half reachable from next door.
 */
export type ItemSlot = "ne" | "se" | "nw" | "sw";

export interface LevelItem {
  id: string;
  type: string;
  x: number;
  z: number;
  /** Omitted = level/query.ts's resolveItemSlot picks a quadrant deterministically from the item's own id. */
  slot?: ItemSlot;
}

/**
 * Forces a specific wall look at a specific wall cell, overriding the
 * deterministic auto-pick (docs/ROADMAP.md M0.10) — e.g. to make sure a
 * secret switch's surrounding stone reads a particular way. Sparse: most
 * wall cells have no entry and fall back to the hash.
 */
export interface WallOverride {
  x: number;
  z: number;
  variant: WallVariantId;
}

export interface LevelJSON {
  formatVersion: 1;
  id: string;
  name: string;
  width: number;
  height: number;
  cells: string[];
  start: LevelStart;
  doors: LevelDoor[];
  wallFeatures: WallFeature[];
  items: LevelItem[];
  /** Optional — omitted/empty is the common case; every existing level file stays valid untouched. */
  wallOverrides?: WallOverride[];
  triggers: unknown[];
  spawns: unknown[];
}

export interface LevelRuntime {
  id: string;
  name: string;
  width: number;
  height: number;
  cells: string[];
  start: LevelStart;
  doors: LevelDoor[];
  wallFeatures: WallFeature[];
  items: LevelItem[];
  wallOverrides: WallOverride[];
}
