import { describe, expect, it } from 'vitest';
import { DEFAULT_WASH, parseWashPreset, renderWashPixels, washPresetKey } from './watercolorWash';

describe('watercolor texture production', () => {
  it('reproduces a preset without a clock and varies stable seeds/views', () => {
    const original = renderWashPixels(32, 'woodland');
    expect(renderWashPixels(32, 'woodland', parseWashPreset(JSON.parse(JSON.stringify(DEFAULT_WASH))))).toEqual(original);
    expect(renderWashPixels(32, 'woodland', { ...DEFAULT_WASH, seed: 'different' })).not.toEqual(original);
    expect(renderWashPixels(32, 'woodland', DEFAULT_WASH, 3)).not.toEqual(original);
    expect(washPresetKey({ ...DEFAULT_WASH, rim: .9 })).not.toBe(washPresetKey());
  });
  it('retains a transparent gutter and translucent pigment without a paper backing', () => {
    for (const palette of ['woodland', 'dirt', 'water', 'slate', 'wine'] as const) {
      const data = renderWashPixels(64, palette), alpha = Array.from(data).filter((_, i) => i % 4 === 3);
      expect(Math.max(...alpha)).toBeGreaterThan(24);
      expect(Math.max(...alpha)).toBeLessThan(200);
      for (let i = 0; i < 64; i++) for (const offset of [i * 4, (63 * 64 + i) * 4, i * 64 * 4, (i * 64 + 63) * 4]) expect(data[offset + 3]).toBe(0);
    }
    expect(renderWashPixels(32, 'dirt', { ...DEFAULT_WASH, opacity: 0 }).every(v => v === 0)).toBe(true);
  });
  it('bounds imported settings and allocation, rejecting unrelated session data', () => {
    for (const invalid of [{ ...DEFAULT_WASH, load: NaN }, { ...DEFAULT_WASH, opacity: 1.1 }, { ...DEFAULT_WASH, seed: '' }, { ...DEFAULT_WASH, version: 2 }, { ...DEFAULT_WASH, mana: 5 }]) expect(() => parseWashPreset(invalid)).toThrow();
    expect(() => renderWashPixels(4096, 'woodland')).toThrow();
    for (const value of [0, 1]) expect(renderWashPixels(32, 'dirt', { ...DEFAULT_WASH, load: value, water: value, rim: value, granulation: value, roughness: value })).toHaveLength(4096);
  });
});
