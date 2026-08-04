export interface ConsumableEffect {
  restores: "food" | "water";
  amount: number;
}

export interface ItemType {
  id: string;
  name: string;
  stackable: boolean;
  consumable?: ConsumableEffect;
}

/** M0 item type registry (LEVELS.md). Levels reference these by string key. */
export const ITEM_REGISTRY: Record<string, ItemType> = {
  shortsword: { id: "shortsword", name: "Shortsword", stackable: false },
  torch: { id: "torch", name: "Torch", stackable: false },
  bread: {
    id: "bread",
    name: "Bread",
    stackable: true,
    consumable: { restores: "food", amount: 30 },
  },
  waterflask: {
    id: "waterflask",
    name: "Waterflask",
    stackable: true,
    consumable: { restores: "water", amount: 30 },
  },
  ironkey: { id: "ironkey", name: "Iron Key", stackable: false },
  scroll: { id: "scroll", name: "Scroll", stackable: false },
};
