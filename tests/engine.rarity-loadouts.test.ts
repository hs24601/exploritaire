import { describe, expect, it } from 'vitest';
import type { OrimRarity } from '../src/engine/types';
import {
  autoFillEffectsByRarityFromCommon,
  buildEffectsByRarityLoadouts,
  normalizeRarityValueMap,
  resolveCostByRarity,
} from '../src/engine/rarityLoadouts';

type TestEffect = {
  type: string;
  value: number;
  target?: string;
  valueByRarity?: Partial<Record<OrimRarity, number>>;
};

describe('rarity loadout guards', () => {
  it('migrates legacy effects into rarity loadouts', () => {
    const legacy: { effects: TestEffect[] } = {
      effects: [{
        type: 'damage',
        value: 4,
        target: 'enemy',
        valueByRarity: { common: 4, rare: 8 },
      }],
    };
    const loadouts = buildEffectsByRarityLoadouts(legacy, 'mythic');
    expect(loadouts.common[0].value).toBe(4);
    expect(loadouts.uncommon[0].value).toBe(4);
    expect(loadouts.rare[0].value).toBe(8);
    expect(loadouts.epic[0].value).toBe(8);
    expect(loadouts.legendary[0].value).toBe(8);
    expect(loadouts.mythic[0].value).toBe(8);
  });

  it('backfills sparse mapped rarity loadouts from prior rarity', () => {
    const sparse = {
      effectsByRarity: {
        common: [{ type: 'damage', value: 2 }],
        rare: [{ type: 'damage', value: 6 }],
      },
    };
    const loadouts = buildEffectsByRarityLoadouts(sparse, 'common');
    expect(loadouts.uncommon[0].value).toBe(2);
    expect(loadouts.rare[0].value).toBe(6);
    expect(loadouts.epic[0].value).toBe(6);
    expect(loadouts.legendary[0].value).toBe(6);
    expect(loadouts.mythic[0].value).toBe(6);
  });
});

describe('rarity cost guards', () => {
  it('normalizes sparse rarity cost maps with forward anchors', () => {
    const normalized = normalizeRarityValueMap(
      { common: 1, rare: 3, mythic: 6 },
      0
    );
    expect(normalized.common).toBe(1);
    expect(normalized.uncommon).toBe(1);
    expect(normalized.rare).toBe(3);
    expect(normalized.epic).toBe(3);
    expect(normalized.legendary).toBe(3);
    expect(normalized.mythic).toBe(6);
  });

  it('resolves cost from baseline legacy cards without costByRarity', () => {
    expect(resolveCostByRarity({ cost: 2 }, 'common')).toBe(2);
    expect(resolveCostByRarity({ cost: 2 }, 'mythic')).toBe(2);
  });
});

describe('rarity auto-fill balance', () => {
  it('scales damage substantially while staying monotonic and capped', () => {
    const loadouts = autoFillEffectsByRarityFromCommon([
      { type: 'damage', value: 4, target: 'enemy' },
    ]);
    expect(loadouts.common[0].value).toBe(4);
    expect(loadouts.uncommon[0].value).toBe(6);
    expect(loadouts.rare[0].value).toBe(8);
    expect(loadouts.epic[0].value).toBe(12);
    expect(loadouts.legendary[0].value).toBe(15);
    expect(loadouts.mythic[0].value).toBe(19);
  });

  it('keeps control effects conservative on auto-fill curve', () => {
    const loadouts = autoFillEffectsByRarityFromCommon([
      { type: 'draw', value: 1, target: 'self' },
    ]);
    expect(loadouts.common[0].value).toBe(1);
    expect(loadouts.uncommon[0].value).toBe(1);
    expect(loadouts.rare[0].value).toBe(1);
    expect(loadouts.epic[0].value).toBe(1);
    expect(loadouts.legendary[0].value).toBe(2);
    expect(loadouts.mythic[0].value).toBeLessThanOrEqual(2);
  });
});
