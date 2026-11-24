import { describe, expect, it } from 'vitest';
import { DEFAULT_DABS, parseRadialDabPreset, radialDabKey, radialDabSpecs } from './radialDabs';
import { DEFAULT_PAINT, isRadialDabPreset, parsePaintPreset, paintPresetKey } from './watercolorPaint';
import { DEFAULT_WASH } from './watercolorWash';

describe('radial dab presets', () => {
  it('defaults to the original native-gradient recipe with reproducible variations', () => {
    expect(isRadialDabPreset(DEFAULT_PAINT)).toBe(true);
    expect(DEFAULT_DABS).toMatchObject({ seed: 81723, count: 85, spreadX: 145, spreadY: 145, minRadius: 18, maxRadius: 62, opacity: .15 });
    const roundTrip = parseRadialDabPreset(JSON.parse(JSON.stringify(DEFAULT_DABS)));
    expect(radialDabSpecs(roundTrip)).toEqual(radialDabSpecs(DEFAULT_DABS));
    expect(radialDabSpecs(roundTrip, 3)).not.toEqual(radialDabSpecs(DEFAULT_DABS));
    expect(radialDabSpecs({ ...roundTrip, seed: 44 })).not.toEqual(radialDabSpecs(roundTrip));
    expect(radialDabKey(roundTrip)).toBe(radialDabKey());
    expect(paintPresetKey(DEFAULT_WASH)).not.toBe(paintPresetKey());
  });
  it('round trips all palette colors without accepting game state or unbounded work', () => {
    const custom = { ...DEFAULT_DABS, colors: { ...DEFAULT_DABS.colors, woodland: ['#123456', '#abcdef'] } };
    expect(parsePaintPreset(custom)).toEqual(custom);
    expect(paintPresetKey(parsePaintPreset(custom))).not.toBe(paintPresetKey());
    for (const invalid of [{ ...DEFAULT_DABS, count: 100000 }, { ...DEFAULT_DABS, count: 2.5 }, { ...DEFAULT_DABS, seed: -1 }, { ...DEFAULT_DABS, opacity: NaN }, { ...DEFAULT_DABS, minRadius: 64, maxRadius: 10 }, { ...DEFAULT_DABS, spreadX: Infinity }, { ...DEFAULT_DABS, mana: 12 }, { ...DEFAULT_DABS, colors: { ...DEFAULT_DABS.colors, woodland: ['red', 'blue'] } }]) expect(() => parsePaintPreset(invalid)).toThrow();
    expect(parsePaintPreset(DEFAULT_WASH)).toEqual(DEFAULT_WASH);
  });
  it('keeps positions within the authored spread and radius bounds', () => {
    const preset = parseRadialDabPreset({ ...DEFAULT_DABS, count: 256, spreadX: 80, spreadY: 0, minRadius: 20, maxRadius: 20 });
    const specs = radialDabSpecs(preset);
    expect(specs).toHaveLength(256);
    expect(specs.every(dab => dab.x >= 88 && dab.x <= 168 && dab.y === 128 && dab.radius === 20)).toBe(true);
  });
});
