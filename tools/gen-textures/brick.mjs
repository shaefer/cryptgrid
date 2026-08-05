import {
  createImage,
  blendPixel,
  cracks,
  fillRect,
  fillRectWrapX,
  forEachXWrapped,
  grunge,
  hexToRgb,
  jitterColor,
  moss,
  mulberry32,
  streaks,
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
  // Moss/water-stain atmosphere pass (M0.11) — opt-in, null/0 skips entirely
  // so anything not passing these regenerates byte-identical to before.
  mossColor = null,
  mossOpacity = 0.45,
  mossClusters = 0,
  streakColor = null,
  streakOpacity = 0.15,
  streakCount = 0,
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
  if (mossColor && mossClusters > 0) {
    moss(png, rng, hexToRgb(mossColor), mossOpacity, mossClusters, brickW, brickH);
  }
  if (streakColor && streakCount > 0) {
    streaks(png, rng, hexToRgb(streakColor), streakOpacity, streakCount, brickH);
  }

  return png;
}

/** The pixel rect of a specific (row, col) brick — shared by the secret-tell drawers below. */
export function brickRect(row, col, brickW, brickH, mortarPx) {
  const rowOffset = row % 2 === 0 ? 0 : Math.floor(brickW / 2);
  const x0 = col * brickW + rowOffset;
  const y0 = row * brickH;
  return { x0, y0, w: brickW - mortarPx, h: brickH - mortarPx };
}

/**
 * Conspicuous secret tell (docs/ROADMAP.md M0.11, from a reference screenshot):
 * a hard-edged, keyhole/slot-shaped dark recess carved into one brick, with an
 * inner-shadow gradient suggesting real depth and a thin highlight along the
 * top lip where light catches the carved edge. Draws directly onto an
 * already-opaque base texture (blendPixel, not the alpha-aware gradient —
 * there's no transparency here to shade onto).
 */
export function carvedRecess(png, row, col, brickW, brickH, mortarPx) {
  const { x0, y0, w, h } = brickRect(row, col, brickW, brickH, mortarPx);
  const slotW = Math.round(w * 0.55);
  const slotH = Math.round(h * 0.32);
  const rx0 = Math.round(x0 + (w - slotW) / 2);
  const ry0 = Math.round(y0 + (h - slotH) / 2);

  fillRect(png, rx0, ry0, slotW, slotH, 14, 13, 12, 235);

  // Inner-shadow gradient: darker toward the bottom of the recess.
  for (let dy = 0; dy < slotH; dy++) {
    const depth = dy / slotH;
    for (let dx = 0; dx < slotW; dx++) {
      blendPixel(png, rx0 + dx, ry0 + dy, 0, 0, 0, 0.25 * depth);
    }
  }
  // Highlight lip along the top edge.
  for (let dx = 0; dx < slotW; dx++) {
    blendPixel(png, rx0 + dx, ry0 - 1, 255, 255, 255, 0.3);
  }
  // Contact shadow just below the recess.
  for (let dx = -1; dx <= slotW; dx++) {
    blendPixel(png, rx0 + dx, ry0 + slotH, 0, 0, 0, 0.35);
  }
}

/**
 * Subtle secret tell (docs/ROADMAP.md M0.11): a small irregular dark blob
 * deliberately placed at a target brick, sized and blended to match the
 * texture's own grunge noise — findable only on close, deliberate inspection,
 * not from a glance. `rng` should be an independent stream from the base
 * texture's own so re-tinting the tell never perturbs the base render.
 */
export function subtleMark(png, rng, row, col, brickW, brickH, mortarPx) {
  const { x0, y0, w, h } = brickRect(row, col, brickW, brickH, mortarPx);
  const cx = x0 + w * (0.3 + rng() * 0.4);
  const cy = y0 + h * (0.3 + rng() * 0.4);
  const r = Math.min(w, h) * 0.12;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        blendPixel(png, Math.round(cx + dx), Math.round(cy + dy), 10, 9, 8, 0.25 + rng() * 0.15);
      }
    }
  }
}
