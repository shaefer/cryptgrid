/**
 * Render-only sizing for flat ground-plane item quads (docs/ROADMAP.md
 * M0.11) — game-side tuning, not game-rule data, so it lives here rather
 * than packages/sim's ItemType (mirrors the tuning.ts split: sim math vs.
 * render feel). Diagonal/foreshortened art (sword, torch) reads correctly
 * at a larger footprint than upright-silhouette art (key, bread).
 */
export const ITEM_VISUAL_SCALE: Record<string, number> = {
  shortsword: 0.7,
  torch: 0.55,
  bread: 0.45,
  waterflask: 0.5,
  ironkey: 0.35,
  scroll: 0.4,
};

export const DEFAULT_ITEM_SCALE = 0.5;

export function itemVisualScale(itemType: string): number {
  return ITEM_VISUAL_SCALE[itemType] ?? DEFAULT_ITEM_SCALE;
}
