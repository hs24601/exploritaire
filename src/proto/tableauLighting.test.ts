import { describe, expect, it } from 'vitest';
import { createTableauLightRig } from './tableauLighting';

describe('tableau scene lighting', () => {
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
