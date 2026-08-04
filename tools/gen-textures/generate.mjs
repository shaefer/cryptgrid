import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brickTexture } from "./brick.mjs";
import { blendPixel, createImage, fillRect, hexToRgb, savePNG, tilePreview } from "./pixel.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../assets/textures");
const PREVIEW_DIR = path.join(OUT_DIR, "_preview");
mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(PREVIEW_DIR, { recursive: true });

// ASSETS.md palette.
const PALETTE = {
  stone: "#585d64",
  stoneDark: "#33363b",
  mortar: "#2e3136",
  mortarDark: "#232529",
  floorBase: "#5a5048",
  floorMortar: "#2b241f",
  ceilingBase: "#3d4046",
  iron: "#3a3d42",
  ironLight: "#55585e",
};

function save(name, png) {
  savePNG(png, path.join(OUT_DIR, `${name}.png`));
  console.log(`wrote ${name}.png`);
}

function saveWithPreview(name, png) {
  save(name, png);
  tilePreview(png, path.join(PREVIEW_DIR, `${name}_2x2.png`));
}

const wallStoneParams = {
  seed: 1001,
  brickW: 64,
  brickH: 32,
  baseColor: PALETTE.stone,
  mortarColor: PALETTE.mortar,
  jitterAmount: 0.08,
  grungeOpacity: 0.05,
  grungeCount: 35,
  crackCount: 2,
};

// wall_stone.png — default wall.
saveWithPreview("wall_stone", brickTexture(wallStoneParams));

// wall_stone_secretbrick.png — same wall, one brick subtly proud + hairline shadow.
saveWithPreview(
  "wall_stone_secretbrick",
  brickTexture({ ...wallStoneParams, proudBrick: { row: 6, col: 4 } }),
);

// wall_fieldstone.png — 2nd wall type (M0.8): irregular, organic block
// variation. Smaller warm-grey stones with broken courses (shiftPx) so a
// secret has several plausible places to hide, not one uniform bond.
const wallFieldstoneParams = {
  seed: 5005,
  brickW: 44,
  brickH: 28,
  baseColor: "#5d574d",
  mortarColor: PALETTE.mortar,
  jitterAmount: 0.16,
  shiftPx: 6,
  grungeOpacity: 0.07,
  grungeCount: 55,
  crackCount: 3,
};
saveWithPreview("wall_fieldstone", brickTexture(wallFieldstoneParams));
saveWithPreview(
  "wall_fieldstone_secretbrick",
  brickTexture({ ...wallFieldstoneParams, proudBrick: { row: 8, col: 5 } }),
);

// wall_hewn.png — 3rd wall type (M0.8): big rough-hewn slabs, darker,
// heavier grunge and cracking.
const wallHewnParams = {
  seed: 6006,
  brickW: 96,
  brickH: 56,
  mortarPx: 7,
  baseColor: "#44474d",
  mortarColor: PALETTE.mortarDark,
  jitterAmount: 0.12,
  grungeOpacity: 0.12,
  grungeCount: 80,
  crackCount: 8,
};
saveWithPreview("wall_hewn", brickTexture(wallHewnParams));
saveWithPreview(
  "wall_hewn_secretbrick",
  brickTexture({ ...wallHewnParams, proudBrick: { row: 4, col: 2 } }),
);

// wall_alcove_back.png — darker recessed variant.
saveWithPreview(
  "wall_alcove_back",
  brickTexture({
    seed: 4004,
    brickW: 64,
    brickH: 32,
    baseColor: PALETTE.stoneDark,
    mortarColor: PALETTE.mortarDark,
    jitterAmount: 0.06,
    grungeOpacity: 0.08,
    grungeCount: 50,
    crackCount: 1,
  }),
);

// floor_stone.png — smaller flagstones, warmer, heavier grime.
saveWithPreview(
  "floor_stone",
  brickTexture({
    seed: 2002,
    brickW: 32,
    brickH: 32,
    baseColor: PALETTE.floorBase,
    mortarColor: PALETTE.floorMortar,
    jitterAmount: 0.1,
    grungeOpacity: 0.09,
    grungeCount: 70,
    crackCount: 4,
  }),
);

// ceiling_stone.png — rough-hewn, darkest.
saveWithPreview(
  "ceiling_stone",
  brickTexture({
    seed: 3003,
    brickW: 64,
    brickH: 64,
    baseColor: PALETTE.ceilingBase,
    mortarColor: PALETTE.mortarDark,
    jitterAmount: 0.1,
    grungeOpacity: 0.08,
    grungeCount: 60,
    crackCount: 5,
  }),
);

// door_portcullis.png — iron bars on a transparent background.
function portcullisTexture(size = 512) {
  const png = createImage(size, false);
  const [ir, ig, ib] = hexToRgb(PALETTE.iron);
  const [hr, hg, hb] = hexToRgb(PALETTE.ironLight);
  const barW = 22;
  const gap = 40;
  for (let x = Math.floor(gap / 2); x < size; x += gap) {
    fillRect(png, x, 0, barW, size, ir, ig, ib, 255);
    for (let y = 0; y < size; y++) {
      blendPixel(png, x, y, hr, hg, hb, 0.4);
      blendPixel(png, x + barW - 1, y, 0, 0, 0, 0.4);
    }
  }
  const barH = 26;
  for (const y of [Math.round(size * 0.25), Math.round(size * 0.62)]) {
    fillRect(png, 0, y, size, barH, ir, ig, ib, 255);
    for (let x = 0; x < size; x++) {
      blendPixel(png, x, y, hr, hg, hb, 0.4);
      blendPixel(png, x, y + barH - 1, 0, 0, 0, 0.4);
    }
  }
  return png;
}
save("door_portcullis", portcullisTexture());

// door_secret.png — wall_stone with a faint seam cross (the hidden doorframe).
function secretDoorTexture() {
  const png = brickTexture(wallStoneParams);
  const size = png.width;
  const midX = Math.floor(size / 2);
  const midY = Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    blendPixel(png, midX, y, 15, 14, 13, 0.12);
    blendPixel(png, midX + 1, y, 15, 14, 13, 0.08);
  }
  for (let x = 0; x < size; x++) {
    blendPixel(png, x, midY, 15, 14, 13, 0.12);
    blendPixel(png, x, midY + 1, 15, 14, 13, 0.08);
  }
  return png;
}
save("door_secret", secretDoorTexture());

// feature_switch.png — visible wall-mounted stone push button (M0.8).
// Transparent bg; a square plate with a round pressable button.
function featureSwitchTexture(size = 256) {
  const png = createImage(size, false);
  const [pr, pg, pb] = hexToRgb("#4a4e55");
  const [br2, bg2, bb2] = hexToRgb("#6b7078");
  fillRect(png, 64, 64, 128, 128, pr, pg, pb, 255); // plate
  for (let i = 0; i < 128; i++) {
    blendPixel(png, 64 + i, 64, 255, 255, 255, 0.2); // top bevel
    blendPixel(png, 64 + i, 191, 0, 0, 0, 0.35); // bottom shadow
    blendPixel(png, 64, 64 + i, 255, 255, 255, 0.12);
    blendPixel(png, 191, 64 + i, 0, 0, 0, 0.25);
  }
  // The button itself, offset highlight for a domed read.
  const cx = 128;
  const cy = 128;
  for (let dy = -34; dy <= 34; dy++) {
    for (let dx = -34; dx <= 34; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 34) continue;
      const lit = Math.max(0, 1 - Math.hypot(dx + 10, dy + 10) / 48);
      blendPixel(png, cx + dx, cy + dy, br2, bg2, bb2, 1);
      blendPixel(png, cx + dx, cy + dy, 255, 255, 255, 0.25 * lit);
      if (d > 31) blendPixel(png, cx + dx, cy + dy, 0, 0, 0, 0.4);
    }
  }
  return png;
}
save("feature_switch", featureSwitchTexture());

// feature_lever.png / feature_lever_on.png — wall lever, off (handle up) and
// on (handle down) frames (ASSETS.md "on/off frames").
function featureLeverTexture(size = 256, on = false) {
  const png = createImage(size, false);
  const [pr, pg, pb] = hexToRgb(PALETTE.iron);
  const [hr, hg, hb] = hexToRgb(PALETTE.ironLight);
  const [wr, wg, wb] = hexToRgb("#5c4a3a");
  fillRect(png, 96, 88, 64, 80, pr, pg, pb, 255); // base plate
  for (let i = 0; i < 64; i++) {
    blendPixel(png, 96 + i, 88, hr, hg, hb, 0.4);
    blendPixel(png, 96 + i, 167, 0, 0, 0, 0.4);
  }
  // Handle: a thick diagonal from the pivot, up-right (off) or down-right (on).
  const px = 128;
  const py = 128;
  const dir = on ? 1 : -1;
  for (let t = 0; t <= 72; t++) {
    const hx = px + Math.round(t * 0.55);
    const hy = py + dir * Math.round(t * 0.8);
    fillRect(png, hx - 5, hy - 5, 10, 10, wr, wg, wb, 255);
  }
  // Knob at the tip.
  const tipX = px + Math.round(72 * 0.55);
  const tipY = py + dir * Math.round(72 * 0.8);
  for (let dy = -12; dy <= 12; dy++) {
    for (let dx = -12; dx <= 12; dx++) {
      if (dx * dx + dy * dy <= 144) blendPixel(png, tipX + dx, tipY + dy, hr, hg, hb, 1);
    }
  }
  // Pivot boss on the plate.
  for (let dy = -10; dy <= 10; dy++) {
    for (let dx = -10; dx <= 10; dx++) {
      if (dx * dx + dy * dy <= 100) blendPixel(png, px + dx, py + dy, hr, hg, hb, 1);
    }
  }
  return png;
}
save("feature_lever", featureLeverTexture(256, false));
save("feature_lever_on", featureLeverTexture(256, true));

console.log(`\nAll M0 wall/floor/ceiling/door textures written to ${OUT_DIR}`);
console.log(`Tiled 2x2 previews in ${PREVIEW_DIR} — eyeball for seams.`);
