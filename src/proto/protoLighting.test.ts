import { describe, expect, it } from 'vitest';
import { actorLight, AMBIENT_FLOOR, createTableLightField, DEFAULT_ACTOR_LUMINOSITY, LIGHT_CELL_SIZE, getTableLighting, lightFlicker, sampleTableLight, sampleTableLightArea, standeeLighting, tableObjectShadow } from './protoLighting';
describe('table lighting scaffold', () => {
  it('cycles continuously between noon, twilight and night with a visibility floor', () => {
    expect(getTableLighting(12).daylight).toBe(1);
    expect(getTableLighting(0).phase).toBe('Night');
    expect(getTableLighting(7).phase).toBe('Twilight');
    expect(getTableLighting(36)).toEqual(getTableLighting(12));
    expect(getTableLighting(0).darkness).toBeLessThan(0.7);
  });
  it('moves shadows from west to east as the daylight source moves', () => {
    expect(tableObjectShadow(8, { x: 0, y: 0 })).not.toEqual(tableObjectShadow(16, { x: 0, y: 0 }));
    expect(getTableLighting(8).source.x).toBeLessThan(0);
    expect(getTableLighting(16).source.x).toBeGreaterThan(0);
  });
  it('casts local shadows only inside a tabletop light radius', () => {
    const light = { id: 'lamp', position: { x: 48, y: 0 }, radius: 3 };
    expect(tableObjectShadow(0, { x: 0, y: 0 }, 8, [light])).not.toEqual(tableObjectShadow(0, { x: 0, y: 0 }));
    expect(tableObjectShadow(0, { x: 1000, y: 0 }, 8, [light])).toEqual(tableObjectShadow(0, { x: 1000, y: 0 }));
  });
});

describe('light sampling', () => {
  const lamp = { id: 'lamp', position: { x: 0, y: 0 }, radius: 3, strength: 0.85 };

  it('reports full light at noon and the moonlight floor at night away from lights', () => {
    expect(sampleTableLight(12, { x: 500, y: 0 }, [lamp])).toMatchObject({ percent: 100, level: 'bright' });
    const night = sampleTableLight(0, { x: 500, y: 0 }, [lamp]);
    expect(night.total).toBeCloseTo(AMBIENT_FLOOR);
    expect(night.level).toBe('dark');
    expect(night.dominantLightId).toBeNull();
  });

  it('brightens toward a light at night and fades to nothing at its radius', () => {
    const center = sampleTableLight(0, { x: 0, y: 0 }, [lamp]);
    const edge = sampleTableLight(0, { x: 3 * 48, y: 0 }, [lamp]);
    expect(center.level).toBe('bright');
    expect(center.dominantLightId).toBe('lamp');
    expect(sampleTableLight(0, { x: 48, y: 0 }, [lamp]).total).toBeLessThan(center.total);
    expect(edge.local).toBe(0);
  });

  it('combines overlapping lights without exceeding 100%', () => {
    const second = { ...lamp, id: 'second', position: { x: 24, y: 0 } };
    const both = sampleTableLight(0, { x: 12, y: 0 }, [lamp, second]);
    expect(both.total).toBeGreaterThan(sampleTableLight(0, { x: 12, y: 0 }, [lamp]).total);
    expect(both.total).toBeLessThanOrEqual(1);
    expect(both.contributions).toHaveLength(2);
  });

  it('averages light over a tile footprint and reports how much of it is lit', () => {
    const area = sampleTableLightArea(0, { x: 96, y: 0, width: 192, height: 48 }, [lamp]);
    expect(area.litFraction).toBeGreaterThan(0);
    expect(area.litFraction).toBeLessThan(1);
    const field = createTableLightField(0, [lamp]);
    expect(field.over({ x: 96, y: 0, width: 192, height: 48 })).toEqual(area);
    expect(field.at({ x: 0, y: 0 })).toEqual(sampleTableLight(0, { x: 0, y: 0 }, [lamp]));
  });

  it('keeps flicker visual only and bounded', () => {
    expect(lightFlicker(lamp, 1234)).toBe(1);
    for (let time = 0; time < 5000; time += 97) {
      const value = lightFlicker({ ...lamp, flicker: 1 }, time);
      expect(value).toBeGreaterThan(0.9);
      expect(value).toBeLessThan(1.1);
    }
  });
});

describe('actor candlelight', () => {
  const midnight = 0;
  const hero = actorLight('hero', { x: 0, y: 0 })!;
  it('defaults to a candle: findable in the dark but never enough to explore by', () => {
    const dark = sampleTableLight(midnight, { x: 0, y: 0 }, []);
    const atHero = sampleTableLight(midnight, { x: 0, y: 0 }, [hero]);
    expect(dark.level).toBe('dark');
    expect(atHero.level).toBe('dim');
    expect(atHero.dominantLightId).toBe('actor-light-hero');
    expect(sampleTableLight(midnight, { x: LIGHT_CELL_SIZE * 2, y: 0 }, [hero]).level).toBe('dark');
  });
  it('scales with luminosity and turns off at zero', () => {
    expect(actorLight('hero', { x: 0, y: 0 }, 0)).toBeNull();
    const lantern = actorLight('hero', { x: 0, y: 0 }, 1)!;
    expect(lantern.radius!).toBeGreaterThan(hero.radius!);
    expect(sampleTableLight(midnight, { x: 0, y: 0 }, [lantern]).percent).toBeGreaterThan(sampleTableLight(midnight, { x: 0, y: 0 }, [hero]).percent);
    expect(hero.strength).toBe(DEFAULT_ACTOR_LUMINOSITY);
  });
});

describe('sprite standee lighting', () => {
  const at = { x: 0, y: 0 };
  const lamp = { id: 'lamp', position: { x: -96, y: 0 }, radius: 5, strength: 0.85, height: 100, color: '#ffb45a' };

  it('casts a shadow away from an off-base lamp and catches its rim light at night', () => {
    const lit = standeeLighting(0, at, 64, [lamp]);
    const shadow = lit.shadows.find((entry) => entry.lightId === 'lamp')!;
    // The lamp is to the left, so the shadow falls to the right (90° clockwise from up).
    expect(shadow.angle).toBeCloseTo(90, 5);
    expect(shadow.opacity).toBeGreaterThan(0.3);
    expect(lit.rim?.x).toBeCloseTo(-1, 5);
    expect(lit.warmth).toBeGreaterThan(0.3);
  });

  it('is brighter by day and in lamplight than in the dark', () => {
    expect(standeeLighting(12, at, 64).brightness).toBeGreaterThan(standeeLighting(0, at, 64).brightness);
    expect(standeeLighting(0, at, 64, [lamp]).brightness).toBeGreaterThan(standeeLighting(0, at, 64).brightness);
  });

  it('lets a carried candle light the standee without casting a shadow from its own base', () => {
    const candle = actorLight('hero', at)!;
    const lit = standeeLighting(0, at, 64, [candle]);
    expect(lit.shadows.some((entry) => entry.lightId === candle.id)).toBe(false);
    expect(lit.rim).toBeNull();
    expect(lit.brightness).toBeGreaterThan(standeeLighting(0, at, 64).brightness);
  });

  it('lengthens shadows as the light gets lower', () => {
    const high = standeeLighting(0, at, 64, [{ ...lamp, height: 300 }]).shadows.find((entry) => entry.lightId === 'lamp')!;
    const low = standeeLighting(0, at, 64, [{ ...lamp, height: 90 }]).shadows.find((entry) => entry.lightId === 'lamp')!;
    expect(low.length).toBeGreaterThan(high.length);
  });
});
