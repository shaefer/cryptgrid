import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  blendPixel,
  createImage,
  fillCircle,
  fillEllipse,
  fillRect,
  hexToRgb,
  savePNG,
} from "../gen-textures/pixel.mjs";

// Colored placeholder silhouettes (ASSETS.md "Wave 1: item sprites") — a
// chunky readable painted-icon style, not final art. 128x128, transparent.
const SIZE = 128;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../assets/items");
mkdirSync(OUT_DIR, { recursive: true });

function save(name, png) {
  savePNG(png, path.join(OUT_DIR, `${name}.png`));
  console.log(`wrote ${name}.png`);
}

/** A 1-2px darker rim on every shape reads better against both dark and light HUD backgrounds. */
function outline(png, x0, y0, w, h, hex, alpha = 0.5) {
  const [r, g, b] = hexToRgb(hex);
  for (let x = x0; x < x0 + w; x++) {
    blendPixel(png, x, y0, r, g, b, alpha);
    blendPixel(png, x, y0 + h - 1, r, g, b, alpha);
  }
  for (let y = y0; y < y0 + h; y++) {
    blendPixel(png, x0, y, r, g, b, alpha);
    blendPixel(png, x0 + w - 1, y, r, g, b, alpha);
  }
}

function shortsword() {
  const png = createImage(SIZE, false);
  const [blade] = [hexToRgb("#c9ccd1")];
  fillRect(png, 58, 16, 12, 66, ...blade); // blade
  fillRect(png, 40, 78, 48, 8, ...hexToRgb("#3a3d42")); // crossguard
  fillRect(png, 56, 86, 16, 26, ...hexToRgb("#5c4a3a")); // grip
  fillCircle(png, 64, 114, 9, ...hexToRgb("#3a3d42")); // pommel
  outline(png, 58, 16, 12, 66, "#6b7078");
  return png;
}

function torch() {
  const png = createImage(SIZE, false);
  fillRect(png, 58, 60, 12, 56, ...hexToRgb("#5c4a3a")); // handle
  fillEllipse(png, 64, 40, 20, 26, ...hexToRgb("#b23a2a")); // outer flame
  fillEllipse(png, 64, 36, 14, 19, ...hexToRgb("#e8823a")); // mid flame
  fillEllipse(png, 64, 32, 8, 11, ...hexToRgb("#f5c542")); // inner flame
  return png;
}

function bread() {
  const png = createImage(SIZE, false);
  fillEllipse(png, 64, 68, 40, 26, ...hexToRgb("#a3763a"));
  fillEllipse(png, 64, 62, 40, 22, ...hexToRgb("#c99a52"));
  for (const dx of [-18, 0, 18]) {
    fillRect(png, 62 + dx, 46, 4, 20, ...hexToRgb("#8a5f2c"));
  }
  outline(png, 24, 42, 80, 52, "#5c4a3a", 0.35);
  return png;
}

function waterflask() {
  const png = createImage(SIZE, false);
  fillEllipse(png, 64, 76, 26, 32, ...hexToRgb("#3a6fb2")); // body
  fillEllipse(png, 64, 70, 22, 26, ...hexToRgb("#5089c9")); // highlight
  fillRect(png, 56, 30, 16, 24, ...hexToRgb("#3a6fb2")); // neck
  fillRect(png, 52, 22, 24, 10, ...hexToRgb("#5c4a3a")); // cap
  return png;
}

function ironkey() {
  const png = createImage(SIZE, false);
  const iron = hexToRgb("#8a8f96");
  fillCircle(png, 44, 40, 22, ...iron);
  fillCircle(png, 44, 40, 11, 0, 0, 0, 0); // punch out the bow's center
  fillRect(png, 40, 58, 8, 44, ...iron); // shaft
  fillRect(png, 48, 88, 14, 8, ...iron); // tooth
  fillRect(png, 48, 74, 10, 8, ...iron); // tooth
  return png;
}

function scroll() {
  const png = createImage(SIZE, false);
  fillRect(png, 20, 50, 88, 28, ...hexToRgb("#d8c9a0"));
  fillCircle(png, 20, 64, 14, ...hexToRgb("#b8a578"));
  fillCircle(png, 108, 64, 14, ...hexToRgb("#b8a578"));
  fillRect(png, 30, 58, 68, 3, ...hexToRgb("#8a7c58"));
  fillRect(png, 30, 68, 52, 3, ...hexToRgb("#8a7c58"));
  return png;
}

save("shortsword", shortsword());
save("torch", torch());
save("bread", bread());
save("waterflask", waterflask());
save("ironkey", ironkey());
save("scroll", scroll());

console.log(`\nAll M0 item sprites written to ${OUT_DIR}`);
