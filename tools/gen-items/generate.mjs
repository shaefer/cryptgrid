import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  blendPixel,
  blendPixelIfOpaque,
  createImage,
  fillCircle,
  fillEllipse,
  fillEllipseGradient,
  fillRect,
  fillRotatedRect,
  fillRotatedRectGradient,
  hexToRgb,
  savePNG,
} from "../gen-textures/pixel.mjs";

// Foreshortened, grounded item icons (docs/ROADMAP.md M0.11, from a reference
// screenshot showing items resting on an alcove floor with real shading) — a
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

/** Soft ground-contact shadow, drawn first so everything else sits on top of it — grounds the item instead of it floating. */
function groundShadow(png, cx, cy, rx, ry) {
  fillEllipseGradient(png, cx, cy, rx, ry, [8, 7, 6], [8, 7, 6], 0.4, 0);
}

/**
 * Directional light-to-dark pass (lighter upper-left, darker lower-right,
 * matching the torch-lit scene) — masked so it only shades the item's own
 * already-opaque silhouette, never bleeds into the transparent background.
 */
function directionalShading(png, cx, cy, r) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const d = Math.hypot(dx, dy) / r;
      if (d > 1) continue;
      const litD = Math.hypot(dx + r * 0.5, dy + r * 0.5) / (r * 1.6);
      const shadowD = Math.hypot(dx - r * 0.5, dy - r * 0.5) / (r * 1.6);
      if (litD < 1) blendPixelIfOpaque(png, cx + dx, cy + dy, 255, 255, 255, (1 - litD) * 0.22);
      if (shadowD < 1) blendPixelIfOpaque(png, cx + dx, cy + dy, 0, 0, 0, (1 - shadowD) * 0.22);
    }
  }
}

function shortsword() {
  const png = createImage(SIZE, false);
  const angle = (35 * Math.PI) / 180; // lying diagonal, not standing upright
  groundShadow(png, 66, 70, 46, 16);

  // Outline pass: a slightly larger dark silhouette drawn first, real shapes on top inset a hair.
  fillRotatedRect(png, 60, 62, 76, 15, angle, ...hexToRgb("#3a3d42"));
  fillRotatedRectGradient(png, 60, 62, 72, 11, angle, hexToRgb("#8a8f96"), hexToRgb("#e8ecf0"));
  // Crossguard: short rect perpendicular to the blade, near the hilt end.
  fillRotatedRect(png, 88, 82, 8, 30, angle, ...hexToRgb("#3a3d42"));
  // Grip continues the diagonal past the crossguard.
  fillRotatedRect(png, 98, 92, 24, 11, angle, ...hexToRgb("#5c4a3a"));
  // Pommel at the very end.
  fillCircle(png, 106, 100, 7, ...hexToRgb("#3a3d42"));

  directionalShading(png, 64, 76, 40);
  return png;
}

function torch() {
  const png = createImage(SIZE, false);
  const angle = (30 * Math.PI) / 180;
  groundShadow(png, 66, 78, 40, 14);

  fillRotatedRect(png, 60, 76, 66, 13, angle, ...hexToRgb("#5c4a3a")); // handle, lying diagonal
  // Flame at the head end of the handle — kept for readability even though
  // a dropped torch wouldn't realistically stay lit.
  const flameX = 30;
  const flameY = 58;
  fillEllipse(png, flameX, flameY, 18, 23, ...hexToRgb("#b23a2a"));
  fillEllipse(png, flameX, flameY - 3, 13, 17, ...hexToRgb("#e8823a"));
  fillEllipse(png, flameX, flameY - 5, 7, 10, ...hexToRgb("#f5c542"));

  directionalShading(png, 64, 76, 36);
  return png;
}

function bread() {
  const png = createImage(SIZE, false);
  groundShadow(png, 64, 76, 42, 18);

  fillEllipse(png, 64, 68, 40, 26, ...hexToRgb("#a3763a"));
  fillEllipse(png, 64, 62, 40, 22, ...hexToRgb("#c99a52"));
  for (const dx of [-18, 0, 18]) {
    fillRect(png, 62 + dx, 46, 4, 20, ...hexToRgb("#8a5f2c"));
  }
  outline(png, 24, 42, 80, 52, "#5c4a3a", 0.35);

  directionalShading(png, 64, 62, 38);
  return png;
}

function waterflask() {
  const png = createImage(SIZE, false);
  groundShadow(png, 64, 92, 30, 12);

  fillEllipse(png, 64, 76, 26, 32, ...hexToRgb("#3a6fb2")); // body
  fillEllipse(png, 64, 70, 22, 26, ...hexToRgb("#5089c9")); // highlight
  fillRect(png, 56, 30, 16, 24, ...hexToRgb("#3a6fb2")); // neck
  fillRect(png, 52, 22, 24, 10, ...hexToRgb("#5c4a3a")); // cap
  outline(png, 38, 22, 52, 66, "#1f3a5c", 0.3);

  directionalShading(png, 64, 60, 42);
  return png;
}

function ironkey() {
  const png = createImage(SIZE, false);
  groundShadow(png, 48, 82, 34, 14);

  const iron = hexToRgb("#8a8f96");
  fillCircle(png, 44, 40, 22, ...iron);
  fillCircle(png, 44, 40, 11, 0, 0, 0, 0); // punch out the bow's center
  fillRect(png, 40, 58, 8, 44, ...iron); // shaft
  fillRect(png, 48, 88, 14, 8, ...iron); // tooth
  fillRect(png, 48, 74, 10, 8, ...iron); // tooth
  outline(png, 22, 18, 44, 44, "#4a4e55", 0.3);

  directionalShading(png, 44, 60, 40);
  return png;
}

function scroll() {
  const png = createImage(SIZE, false);
  groundShadow(png, 64, 78, 46, 16);

  fillRect(png, 20, 50, 88, 28, ...hexToRgb("#d8c9a0"));
  fillCircle(png, 20, 64, 14, ...hexToRgb("#b8a578"));
  fillCircle(png, 108, 64, 14, ...hexToRgb("#b8a578"));
  fillRect(png, 30, 58, 68, 3, ...hexToRgb("#8a7c58"));
  fillRect(png, 30, 68, 52, 3, ...hexToRgb("#8a7c58"));
  outline(png, 6, 50, 116, 28, "#5c4a3a", 0.3);

  directionalShading(png, 64, 64, 44);
  return png;
}

save("shortsword", shortsword());
save("torch", torch());
save("bread", bread());
save("waterflask", waterflask());
save("ironkey", ironkey());
save("scroll", scroll());

console.log(`\nAll M0 item sprites written to ${OUT_DIR}`);
