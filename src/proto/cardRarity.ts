export const CARD_RARITIES=['common','rare','epic','legendary'] as const;
export type CardRarity=typeof CARD_RARITIES[number];
