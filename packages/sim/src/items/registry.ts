export interface ConsumableBonus {
  stat: "hp" | "mana" | "stamina";
  /** Instant bump, not a timed buff — no duration tracking exists yet. */
  amount: number;
}

export interface ConsumableEffect {
  /** Which flavor of the merged Hunger/Thirst bar this restores (docs/STATS.md). */
  kind: "food" | "water";
  amount: number;
  /** Small distinct extra bump per kind — e.g. water leaning Stamina, food leaning HP. */
  bonus?: ConsumableBonus;
}

export interface ItemType {
  id: string;
  name: string;
  stackable: boolean;
  /** Abstract weight units — see docs/STATS.md "Carrying capacity". */
  weight: number;
  /** Whether a held copy can eventually be thrown (M0.7 only sets the flag; throwing itself is later). */
  throwable?: boolean;
  consumable?: ConsumableEffect;
}

/** M0 item type registry (LEVELS.md). Levels reference these by string key. */
export const ITEM_REGISTRY: Record<string, ItemType> = {
  shortsword: {
    id: "shortsword",
    name: "Shortsword",
    stackable: false,
    weight: 6,
    throwable: true,
  },
  torch: { id: "torch", name: "Torch", stackable: false, weight: 2 },
  bread: {
    id: "bread",
    name: "Bread",
    stackable: true,
    weight: 1,
    consumable: {
      kind: "food",
      amount: 30,
      bonus: { stat: "hp", amount: 2 },
    },
  },
  waterflask: {
    id: "waterflask",
    name: "Waterflask",
    stackable: true,
    weight: 2,
    consumable: {
      kind: "water",
      amount: 30,
      bonus: { stat: "stamina", amount: 3 },
    },
  },
  ironkey: { id: "ironkey", name: "Iron Key", stackable: false, weight: 0.5 },
  scroll: { id: "scroll", name: "Scroll", stackable: false, weight: 0.2, throwable: true },
};

export function getItemType(instance: { type: string }): ItemType | undefined {
  return ITEM_REGISTRY[instance.type];
}
