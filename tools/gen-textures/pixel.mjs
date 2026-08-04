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
