import type { OrimRarity } from './types';

export const ORIM_RARITY_ORDER: OrimRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

export const ORIM_RARITY_TIER_INDEX: Record<OrimRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

export type RarityValueMap = Partial<Record<OrimRarity, number>>;

export type RarityMappableEffect = {
  type?: string;
  value?: number;
  valueByRarity?: RarityValueMap;
  [key: string]: unknown;
};

const AUTO_FILL_BASE_MULTIPLIER: Record<OrimRarity, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 2.1,
  epic: 2.9,
  legendary: 3.8,
  mythic: 4.8,
};

const AUTO_FILL_GROWTH_BIAS_BY_EFFECT_TYPE: Record<string, number> = {
  damage: 1,
  healing: 0.9,
  armor: 0.82,
  super_armor: 0.76,
  defense: 0.72,
  evasion: 0.68,
  bleed: 0.74,
  burn: 0.74,
  maxhp: 0.65,
  stun: 0.32,
  freeze: 0.3,
  draw: 0.24,
  redeal_tableau: 0.2,
  upgrade_card_rarity_uncommon: 0.16,
};

const AUTO_FILL_CAP_RATIO_BY_EFFECT_TYPE: Record<string, number> = {
  damage: 4.8,
  healing: 4.2,
  armor: 3.7,
  super_armor: 3.4,
  defense: 3.2,
  evasion: 3,
  bleed: 3.4,
  burn: 3.4,
  maxhp: 2.8,
  stun: 2,
  freeze: 2,
  draw: 2.2,
  redeal_tableau: 2,
  upgrade_card_rarity_uncommon: 1,
};

const HIGH_IMPACT_EFFECT_TYPES = new Set<string>([
  'damage',
  'healing',
  'armor',
  'super_armor',
  'defense',
  'bleed',
  'burn',
]);

function toFiniteNonNegativeNumber(value: number | undefined, fallback = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return Math.max(0, fallback);
  return Math.max(0, value);
}

function roundToValueShape(value: number, baseValue: number): number {
  if (Number.isInteger(baseValue)) return Math.round(value);
  return Number(value.toFixed(2));
}

function normalizeEffectType(type: string | undefined): string {
  return String(type ?? '').trim().toLowerCase();
}

function getAutoFillMultiplier(effectType: string, rarity: OrimRarity): number {
  const base = AUTO_FILL_BASE_MULTIPLIER[rarity] ?? 1;
  if (rarity === 'common') return 1;
  const bias = AUTO_FILL_GROWTH_BIAS_BY_EFFECT_TYPE[effectType] ?? 0.7;
  return 1 + ((base - 1) * bias);
}

function getAutoFillCapRatio(effectType: string): number {
  return AUTO_FILL_CAP_RATIO_BY_EFFECT_TYPE[effectType] ?? 3.2;
}

function scaleValueForRarity(
  baseValueRaw: number,
  effectType: string,
  rarity: OrimRarity,
  previousValueRaw: number
): number {
  const baseValue = toFiniteNonNegativeNumber(baseValueRaw);
  const previousValue = toFiniteNonNegativeNumber(previousValueRaw);
  if (baseValue <= 0) return 0;

  const scaledRaw = baseValue * getAutoFillMultiplier(effectType, rarity);
  const capRaw = baseValue * getAutoFillCapRatio(effectType);
  const scaled = roundToValueShape(scaledRaw, baseValue);
  const capped = Math.min(roundToValueShape(capRaw, baseValue), scaled);
  let nextValue = Math.max(previousValue, capped);

  if (
    rarity !== 'common'
    && nextValue <= previousValue
    && HIGH_IMPACT_EFFECT_TYPES.has(effectType)
  ) {
    nextValue = roundToValueShape(previousValue + 1, baseValue);
  }
  return toFiniteNonNegativeNumber(nextValue);
}

export function cloneRarityMappableEffect<T extends RarityMappableEffect>(effect: T): T {
  return {
    ...effect,
    valueByRarity: effect.valueByRarity ? { ...effect.valueByRarity } : undefined,
  };
}

export function normalizeRarityValueMap(map: RarityValueMap | undefined, fallbackValue: number): Record<OrimRarity, number> {
  const normalizedFallback = toFiniteNonNegativeNumber(fallbackValue);
  const normalized = {} as Record<OrimRarity, number>;
  let anchor = normalizedFallback;
  ORIM_RARITY_ORDER.forEach((rarity) => {
    const current = map?.[rarity];
    if (typeof current === 'number' && Number.isFinite(current)) {
      anchor = toFiniteNonNegativeNumber(current);
    }
    normalized[rarity] = anchor;
  });
  return normalized;
}

export function resolveEffectValueForRarity(
  effect: Pick<RarityMappableEffect, 'value' | 'valueByRarity'>,
  rarity: OrimRarity
): number {
  const normalizedMap = normalizeRarityValueMap(effect.valueByRarity, toFiniteNonNegativeNumber(effect.value));
  return normalizedMap[rarity] ?? normalizedMap.common ?? 0;
}

export function ensureEffectValueByRarity<T extends RarityMappableEffect>(effect: T): T {
  return {
    ...effect,
    valueByRarity: normalizeRarityValueMap(effect.valueByRarity, toFiniteNonNegativeNumber(effect.value)),
  };
}

export function normalizeEffectForRarity<T extends RarityMappableEffect>(effect: T, rarity: OrimRarity): T {
  const normalized = ensureEffectValueByRarity(effect);
  return {
    ...normalized,
    value: resolveEffectValueForRarity(normalized, rarity),
  };
}

export function buildEffectsByRarityLoadouts<T extends RarityMappableEffect>(
  entry: { effects?: T[]; effectsByRarity?: Partial<Record<OrimRarity, T[]>> },
  activeRarity: OrimRarity
): Record<OrimRarity, T[]> {
  const rawMap = entry.effectsByRarity ?? {};
  const hasMappedLoadout = ORIM_RARITY_ORDER.some((rarity) => (
    Object.prototype.hasOwnProperty.call(rawMap, rarity)
  ));

  const result: Partial<Record<OrimRarity, T[]>> = {};
  if (hasMappedLoadout) {
    ORIM_RARITY_ORDER.forEach((rarity) => {
      const source = rawMap[rarity];
      if (!Array.isArray(source)) return;
      result[rarity] = source.map((fx) => normalizeEffectForRarity(fx, rarity));
    });
  } else {
    const legacy = entry.effects ?? [];
    ORIM_RARITY_ORDER.forEach((rarity) => {
      result[rarity] = legacy.map((fx) => normalizeEffectForRarity(fx, rarity));
    });
  }

  ORIM_RARITY_ORDER.forEach((rarity, index) => {
    if (Array.isArray(result[rarity])) return;
    let fallback: T[] = [];
    for (let prior = index - 1; prior >= 0; prior -= 1) {
      const priorEffects = result[ORIM_RARITY_ORDER[prior]];
      if (Array.isArray(priorEffects)) {
        fallback = priorEffects.map((fx) => cloneRarityMappableEffect(fx));
        break;
      }
    }
    if (fallback.length === 0 && Array.isArray(result.common)) {
      fallback = result.common.map((fx) => cloneRarityMappableEffect(fx));
    }
    result[rarity] = fallback;
  });

  const normalized = result as Record<OrimRarity, T[]>;
  if (!Array.isArray(normalized[activeRarity])) normalized[activeRarity] = [];
  return normalized;
}

export function autoFillEffectsByRarityFromCommon<T extends RarityMappableEffect>(
  commonLoadout: T[]
): Record<OrimRarity, T[]> {
  const normalizedCommon = (commonLoadout ?? []).map((effect) => normalizeEffectForRarity(effect, 'common'));
  const byRarity = {} as Record<OrimRarity, T[]>;

  ORIM_RARITY_ORDER.forEach((rarity) => {
    byRarity[rarity] = normalizedCommon.map((effect, index) => {
      const effectType = normalizeEffectType(effect.type);
      const baseValue = toFiniteNonNegativeNumber(effect.value);
      const previousValue = rarity === 'common'
        ? baseValue
        : toFiniteNonNegativeNumber(byRarity[ORIM_RARITY_ORDER[ORIM_RARITY_TIER_INDEX[rarity] - 1]][index]?.value);
      const nextValue = scaleValueForRarity(baseValue, effectType, rarity, previousValue);
      return {
        ...cloneRarityMappableEffect(effect),
        value: nextValue,
        valueByRarity: undefined,
      };
    });
  });

  return byRarity;
}

export type RarityCostCarrier = {
  cost?: number;
  costByRarity?: RarityValueMap;
} | null | undefined;

export function resolveCostByRarity(card: RarityCostCarrier, rarity: OrimRarity | undefined): number {
  if (!card) return 0;
  const targetRarity = rarity ?? 'common';
  const normalized = normalizeRarityValueMap(card.costByRarity, toFiniteNonNegativeNumber(card.cost));
  return toFiniteNonNegativeNumber(normalized[targetRarity] ?? normalized.common ?? 0);
}
