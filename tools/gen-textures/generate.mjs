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

console.log(`\nAll M0 wall/floor/ceiling/door textures written to ${OUT_DIR}`);
console.log(`Tiled 2x2 previews in ${PREVIEW_DIR} — eyeball for seams.`);
