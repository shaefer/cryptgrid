import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function clamp255(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function wrap(v, size) {
  return ((v % size) + size) % size;
}

export function createImage(size, opaque = true) {
  const png = new PNG({ width: size, height: size });
  if (!opaque) png.data.fill(0);
  return png;
}

export function setPixel(png, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = clamp255(r);
  png.data[idx + 1] = clamp255(g);
  png.data[idx + 2] = clamp255(b);
  png.data[idx + 3] = clamp255(a);
}

export function blendPixel(png, x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  const ia = 1 - alpha;
  png.data[idx] = clamp255(png.data[idx] * ia + r * alpha);
  png.data[idx + 1] = clamp255(png.data[idx + 1] * ia + g * alpha);
  png.data[idx + 2] = clamp255(png.data[idx + 2] * ia + b * alpha);
}

export function fillRect(png, x0, y0, w, h, r, g, b, a = 255) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      setPixel(png, x, y, r, g, b, a);
    }
  }
}

export function fillEllipse(png, cx, cy, rx, ry, r, g, b, a = 255) {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      if (nx * nx + ny * ny <= 1) setPixel(png, x, y, r, g, b, a);
    }
  }
}

export function fillCircle(png, cx, cy, radius, r, g, b, a = 255) {
  fillEllipse(png, cx, cy, radius, radius, r, g, b, a);
}

/** Fills a rect, wrapping horizontally past the right edge — keeps brick tiling seamless. */
export function fillRectWrapX(png, x0, w, y0, h, r, g, b, a = 255) {
  const size = png.width;
  const wx0 = wrap(x0, size);
  if (wx0 + w <= size) {
    fillRect(png, wx0, y0, w, h, r, g, b, a);
  } else {
    const w1 = size - wx0;
    fillRect(png, wx0, y0, w1, h, r, g, b, a);
    fillRect(png, 0, y0, w - w1, h, r, g, b, a);
  }
}

export function forEachXWrapped(png, x0, w, y0, h, fn) {
  const size = png.width;
  for (let dx = 0; dx < w; dx++) {
    const x = wrap(x0 + dx, size);
    for (let y = y0; y < y0 + h; y++) fn(x, y);
  }
}

export function jitterColor(rng, [r, g, b], amount) {
  const j = 1 + (rng() * 2 - 1) * amount;
  return [r * j, g * j, b * j];
}

export function grunge(png, rng, opacity, count) {
  const size = png.width;
  for (let i = 0; i < count; i++) {
    const cx = Math.floor(rng() * size);
    const cy = Math.floor(rng() * size);
    const r = 2 + rng() * 6;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          blendPixel(png, wrap(cx + dx, size), wrap(cy + dy, size), 18, 16, 14, opacity * rng());
        }
      }
    }
  }
}

export function cracks(png, rng, count) {
  const size = png.width;
  for (let i = 0; i < count; i++) {
    let x = Math.floor(rng() * size);
    let y = Math.floor(rng() * size);
    let angle = rng() * Math.PI * 2;
    const steps = 40 + Math.floor(rng() * 60);
    for (let s = 0; s < steps; s++) {
      angle += (rng() - 0.5) * 0.5;
      x = wrap(Math.round(x + Math.cos(angle) * 2), size);
      y = wrap(Math.round(y + Math.sin(angle) * 2), size);
      blendPixel(png, x, y, 12, 11, 10, 0.5);
    }
  }
}

/**
 * "Source over" alpha compositing — unlike blendPixel (RGB-only, assumes the
 * destination is already opaque), this also raises the destination alpha, so
 * it can paint soft shading/shadows onto currently-transparent pixels (item
 * sprites' transparent backgrounds). blendPixel stays the right tool for
 * grunge/cracks/moss on wall textures, which are opaque from the base coat up.
 */
export function blendPixelRGBA(png, x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || alpha <= 0) return;
  const idx = (png.width * y + x) << 2;
  const dstA = png.data[idx + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA <= 0) return;
  const mix = (src, dst) => clamp255((src * alpha + dst * dstA * (1 - alpha)) / outA);
  png.data[idx] = mix(r, png.data[idx]);
  png.data[idx + 1] = mix(g, png.data[idx + 1]);
  png.data[idx + 2] = mix(b, png.data[idx + 2]);
  png.data[idx + 3] = clamp255(outA * 255);
}

/**
 * Radial gradient ellipse using blendPixelRGBA — real per-pixel RGBA
 * interpolation by distance from center, the first genuine gradient
 * capability in this toolkit (everything else is hard-edged shape layering).
 * innerAlpha/outerAlpha let a shadow fade all the way to transparent.
 */
export function fillEllipseGradient(png, cx, cy, rx, ry, innerColor, outerColor, innerAlpha, outerAlpha) {
  const x0 = Math.floor(cx - rx);
  const x1 = Math.ceil(cx + rx);
  const y0 = Math.floor(cy - ry);
  const y1 = Math.ceil(cy + ry);
  const [ir, ig, ib] = innerColor;
  const [or_, og, ob] = outerColor;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const nx = (x - cx) / rx;
      const ny = (y - cy) / ry;
      const d = Math.sqrt(nx * nx + ny * ny);
      if (d > 1) continue;
      const r = ir + (or_ - ir) * d;
      const g = ig + (og - ig) * d;
      const b = ib + (ob - ib) * d;
      const a = innerAlpha + (outerAlpha - innerAlpha) * d;
      blendPixelRGBA(png, x, y, r, g, b, a);
    }
  }
}

/**
 * Clustered moss growth — a handful of colony seed points (biased toward
 * brick-grid joints, where moss actually grows) each spawning a few nearby
 * blobs, unlike grunge()'s uniform random scatter. Applied after the brick
 * grid + grunge/cracks, same as those, onto an already-opaque base.
 */
export function moss(png, rng, [mr, mg, mb], opacity, clusterCount, brickW, brickH) {
  const size = png.width;
  for (let c = 0; c < clusterCount; c++) {
    const col = Math.floor(rng() * (size / brickW));
    const row = Math.floor(rng() * (size / brickH));
    // Half the time seed along a horizontal mortar joint, half along a vertical one.
    const alongRow = rng() < 0.5;
    const seedX = wrap(
      Math.round(col * brickW + (alongRow ? (rng() * 2 - 1) * brickW * 0.4 : 0)),
      size,
    );
    const seedY = wrap(
      Math.round(row * brickH + (alongRow ? 0 : (rng() * 2 - 1) * brickH * 0.4)),
      size,
    );
    const blobCount = 3 + Math.floor(rng() * 5);
    for (let b = 0; b < blobCount; b++) {
      const bx = wrap(Math.round(seedX + (rng() * 2 - 1) * brickW * 0.6), size);
      const by = wrap(Math.round(seedY + (rng() * 2 - 1) * brickH * 0.6), size);
      const r = 2 + rng() * 5;
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy <= r * r) {
            blendPixel(png, wrap(bx + dx, size), wrap(by + dy, size), mr, mg, mb, opacity * rng());
          }
        }
      }
    }
  }
}

/** Faint downward-fading water-stain streaks, originating near a mortar row. */
export function streaks(png, rng, [sr, sg, sb], opacity, count, brickH) {
  const size = png.width;
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rng() * size);
    const rows = Math.max(1, Math.floor(size / brickH));
    const startY = wrap(Math.floor(rng() * rows) * brickH, size);
    const length = Math.floor(brickH * (1 + rng() * 3));
    const width = 1 + Math.floor(rng() * 2);
    for (let dy = 0; dy < length; dy++) {
      const y = wrap(startY + dy, size);
      const fade = 1 - dy / length;
      for (let dx = -width; dx <= width; dx++) {
        blendPixel(png, wrap(x + dx, size), y, sr, sg, sb, opacity * fade * (0.5 + rng() * 0.5));
      }
    }
  }
}

/**
 * RGB-only blend (like blendPixel) but a no-op wherever the destination is
 * still fully transparent — for shading an item's own silhouette (highlight/
 * shadow overlays) without bleeding color into the transparent background
 * around it.
 */
export function blendPixelIfOpaque(png, x, y, r, g, b, alpha) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  if (png.data[idx + 3] === 0) return;
  blendPixel(png, x, y, r, g, b, alpha);
}

/** Hard-edged rectangle rotated by angleRad around its own center — for items lying at a diagonal. */
export function fillRotatedRect(png, cx, cy, w, h, angleRad, r, g, b, a = 255) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const hw = w / 2;
  const hh = h / 2;
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) setPixel(png, x, y, r, g, b, a);
    }
  }
}

/**
 * Same as fillRotatedRect but linearly interpolates color along the rect's
 * own length (local x, -hw..hw) from colorA to colorB — a cheap "shiny
 * blade" highlight running the length of a sword, lever handle, etc.
 */
export function fillRotatedRectGradient(png, cx, cy, w, h, angleRad, colorA, colorB, a = 255) {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const hw = w / 2;
  const hh = h / 2;
  const [ar, ag, ab] = colorA;
  const [br, bg, bb] = colorB;
  const corners = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x0 = Math.floor(Math.min(...xs));
  const x1 = Math.ceil(Math.max(...xs));
  const y0 = Math.floor(Math.min(...ys));
  const y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      if (Math.abs(lx) > hw || Math.abs(ly) > hh) continue;
      const t = (lx + hw) / w;
      setPixel(png, x, y, ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t, a);
    }
  }
}

export function savePNG(png, filePath) {
  writeFileSync(filePath, PNG.sync.write(png));
}

export function tilePreview(png, outPath) {
  const size = png.width;
  const preview = new PNG({ width: size * 2, height: size * 2 });
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const srcIdx = (size * y + x) << 2;
          const dstIdx = (preview.width * (ty * size + y) + (tx * size + x)) << 2;
          preview.data[dstIdx] = png.data[srcIdx];
          preview.data[dstIdx + 1] = png.data[srcIdx + 1];
          preview.data[dstIdx + 2] = png.data[srcIdx + 2];
          preview.data[dstIdx + 3] = png.data[srcIdx + 3];
        }
      }
    }
  }
  savePNG(preview, outPath);
}
