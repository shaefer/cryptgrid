import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mulberry32 } from "../gen-textures/pixel.mjs";

// Rune glyphs (ASSETS.md "item sprites & rune glyphs"): 24 seeded angular
// single-stroke paths on a 64x64 grid, 3-6 segments, chisel-cut aesthetic.
// stroke="currentColor" so the HUD inlines them and tints via CSS (unlit /
// lit / insufficient-mana states). All marks original to Cryptgrid.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.resolve(__dirname, "../../assets/runes");
mkdirSync(OUT_DIR, { recursive: true });

// Mirrors packages/sim/src/spells/runes.ts — ids + a per-rune seed offset.
const RUNE_IDS = [
  "eth", "kor", "vas", "dur", "mal", "zeth",
  "lume", "ign", "krys", "vol", "vit", "umbra",
  "dart", "orbis", "vela", "sig", "nim", "korpa",
  "sel", "omn", "fara", "lent", "sub", "vera",
];

/**
 * A single-stroke polyline over a 5x5 lattice mapped into 64x64 with margin.
 * Segments never revisit a point, and each step moves at least 2 lattice
 * units in one axis so strokes stay bold and angular, not scribbly.
 */
function glyphPath(seed) {
  const rng = mulberry32(seed);
  const cell = 12; // 5 lattice points: 8, 20, 32, 44, 56
  const point = (gx, gy) => [8 + gx * cell, 8 + gy * cell];

  const segments = 3 + Math.floor(rng() * 4); // 3-6
  const visited = new Set();
  let gx = Math.floor(rng() * 5);
  let gy = Math.floor(rng() * 5);
  visited.add(`${gx},${gy}`);
  const points = [point(gx, gy)];

  for (let i = 0; i < segments; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 20 && !placed; attempt++) {
      const horizontal = rng() < 0.5;
      const distance = 2 + Math.floor(rng() * 3); // 2-4
      const dir = rng() < 0.5 ? -1 : 1;
      const nx = horizontal ? gx + dir * distance : gx + (rng() < 0.3 ? dir : 0);
      const ny = horizontal ? gy + (rng() < 0.3 ? dir : 0) : gy + dir * distance;
      if (nx < 0 || nx > 4 || ny < 0 || ny > 4) continue;
      if (visited.has(`${nx},${ny}`)) continue;
      gx = nx;
      gy = ny;
      visited.add(`${gx},${gy}`);
      points.push(point(gx, gy));
      placed = true;
    }
  }

  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

RUNE_IDS.forEach((id, index) => {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`,
    `<polyline points="${glyphPath(9000 + index * 131)}" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="square" stroke-linejoin="miter"/>`,
    `</svg>`,
  ].join("\n");
  writeFileSync(path.join(OUT_DIR, `${id}.svg`), svg);
  console.log(`wrote ${id}.svg`);
});

console.log(`\nAll 24 rune glyphs written to ${OUT_DIR}`);
