import type { Facing } from "../facing";

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

/** Sub-tile position within a floor cell — up to 5 items can share one tile, one per slot. */
export type ItemSlot = "center" | "ne" | "se" | "nw" | "sw";

export interface LevelItem {
  id: string;
  type: string;
  x: number;
  z: number;
  /** Omitted = "center". */
  slot?: ItemSlot;
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
}
