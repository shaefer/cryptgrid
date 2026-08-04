import {
  createImage,
  blendPixel,
  cracks,
  fillRectWrapX,
  forEachXWrapped,
  grunge,
  hexToRgb,
  jitterColor,
  mulberry32,
} from "./pixel.mjs";

/**
 * Offset-course brick/block texture (ASSETS.md "Wave 1: procedural texture
 * generator"). Bricks are addressed by (row, col) and always drawn with a
 * single wrapped fillRect, so the running-bond offset tiles seamlessly —
 * no brick is ever split into two independently-jittered halves at the edge.
 */
export function brickTexture({
  seed,
  size = 512,
  brickW,
  brickH,
  mortarPx = 5,
  baseColor,
  mortarColor,
  jitterAmount = 0.08,
  grungeOpacity = 0.06,
  grungeCount = 40,
  crackCount = 3,
  proudBrick = null,
  // Per-brick horizontal shift (px) — breaks the running bond into irregular
  // courses for fieldstone-style walls. 0 (default) skips the rng call
  // entirely so pre-M0.8 textures regenerate byte-identical.
  shiftPx = 0,
}) {
  const rng = mulberry32(seed);
  const png = createImage(size);
  const [mr, mg, mb] = hexToRgb(mortarColor);
  fillRectWrapX(png, 0, size, 0, size, mr, mg, mb);

  const rows = Math.round(size / brickH);
  const cols = Math.round(size / brickW);
  const base = hexToRgb(baseColor);
  const w = brickW - mortarPx;
  const h = brickH - mortarPx;

  for (let row = 0; row < rows; row++) {
    const rowOffset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
    const y0 = row * brickH;
    for (let col = 0; col < cols; col++) {
      const isProud = proudBrick && proudBrick.row === row && proudBrick.col === col;
      const shift = shiftPx ? Math.round((rng() * 2 - 1) * shiftPx) : 0;
      const restX = col * brickW + rowOffset + shift;
      const x0 = restX + (isProud ? 2 : 0);
      const y = y0 + (isProud ? 2 : 0);
      const [br, bg, bb] = jitterColor(rng, base, jitterAmount);

      fillRectWrapX(png, x0, w, y, h, br, bg, bb);
      forEachXWrapped(png, x0, w, y, 1, (px, py) => blendPixel(png, px, py, 255, 255, 255, 0.15));
      forEachXWrapped(png, x0, w, y + h - 1, 1, (px, py) =>
        blendPixel(png, px, py, 0, 0, 0, 0.25),
      );

      if (isProud) {
        // Hairline shadow where the brick used to sit — the secret-switch tell.
        forEachXWrapped(png, restX, w, y0, 2, (px, py) =>
          blendPixel(png, px, py, 0, 0, 0, 0.3),
        );
        forEachXWrapped(png, restX, 2, y0, h, (px, py) =>
          blendPixel(png, px, py, 0, 0, 0, 0.3),
        );
      }
    }
  }

  grunge(png, rng, grungeOpacity, grungeCount);
  cracks(png, rng, crackCount);

  return png;
}
