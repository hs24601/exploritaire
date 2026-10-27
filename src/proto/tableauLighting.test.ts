import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTableauLightRig, tableauCardBrightness } from './tableauLighting';

describe('tableau scene lighting', () => {
  beforeAll(() => vi.stubGlobal('window', { location: { search: '' } }));
  afterAll(() => vi.unstubAllGlobals());
  it('bypasses night shading, local lights and shadows while editing', () => {
    const rig = createTableauLightRig(0, { x: 0, y: 0 }, [{ id: 'glow', position: { x: 0, y: 0 }, strength: 1 }], true, false);
    expect(rig.standee(0, 0)).toMatchObject({ brightness: 1, warmth: 0, rim: null, shadows: [] });
    expect(rig.surface(0, 0)).toMatchObject({ '--surface-brightness': 1, '--surface-light': 'transparent', '--table-object-shadow': 'none' });
  });
  it('keeps a night rack readable with light from its foundation and combines party sources', () => {
    const point = { x: 200, y: 50 };
    const lamp = { x: 200, y: 450, radius: 800 };
    const dark = tableauCardBrightness(.14, point, []);
    const solo = tableauCardBrightness(.14, point, [lamp]);
    const party = tableauCardBrightness(.14, point, [lamp, { ...lamp, x: 350 }]);
    expect(solo).toBeGreaterThan(.85);
    expect(solo).toBeGreaterThan(dark);
    expect(party).toBeGreaterThan(solo);
    expect(party).toBeLessThanOrEqual(1);
  });
  it('does not darken daylight or the global-light bypass, and light falls off with distance', () => {
    const lamp = { x: 0, y: 0, radius: 400 };
    expect(tableauCardBrightness(1, { x: 0, y: 0 }, [])).toBe(1);
    expect(tableauCardBrightness(1, { x: 0, y: 0 }, [lamp])).toBe(1);
    expect(tableauCardBrightness(.14, { x: 0, y: 0 }, [lamp])).toBeGreaterThan(tableauCardBrightness(.14, { x: 300, y: 0 }, [lamp]));
  });
  it('adds local overhead light at night without modifying the world light list', () => {
    const lights = [{ id: 'cyan', position: { x: 220, y: 0 }, color: '#33ffff', strength: 0.8 }];
    const dark = createTableauLightRig(0, { x: 0, y: 0 }, lights, false);
    const lit = createTableauLightRig(0, { x: 0, y: 0 }, lights, true);
    expect(Number(lit.surface(0, 0)['--surface-brightness' as keyof ReturnType<typeof lit.surface>])).toBeGreaterThan(Number(dark.surface(0, 0)['--surface-brightness' as keyof ReturnType<typeof dark.surface>]));
    expect(lit.standee(0, 0).brightness).toBeGreaterThan(dark.standee(0, 0).brightness);
    expect(lights).toHaveLength(1);
  });
  it('uses source direction and color on cards and foundation props', () => {
    const rig = createTableauLightRig(0, { x: 400, y: 200 }, [{ id: 'glow', position: { x: 448, y: 200 }, color: '#33ffff', strength: 1 }], false);
    expect(rig.standee(0, 0).rim?.x).toBeGreaterThan(0);
    expect(rig.standee(0, 0).rim?.color).toEqual({ r: 51, g: 255, b: 255 });
    expect(rig.surface(0, 0)['--surface-light' as keyof ReturnType<typeof rig.surface>]).toContain('51, 255, 255');
  });
});
