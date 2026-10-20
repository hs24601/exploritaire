import type { CSSProperties } from 'react';
import { rgba, sampleTableLight, standeeLighting, tableObjectShadow, type TableLight } from './protoLighting';
import { NEUTRAL_STANDEE_LIGHTING } from './components/SpriteStandee';
import { globalLightsEnabled } from './globalLighting';

/** A local view of the biome's world lighting; the fixture is visual scaffolding
 * for this field only and never changes table exploration or gameplay light. */
export function createTableauLightRig(hours: number, origin: { x: number; y: number }, worldLights: readonly TableLight[], fixture = true, enabled = true) {
  const lights: TableLight[] = [...worldLights, ...(fixture && !new URLSearchParams(window.location.search).has('combatsbx') ? [{
    id: 'tableau-overhead', position: { x: origin.x, y: origin.y - 90 },
    height: 180, radius: 5, strength: 0.72, color: '#ffe0a0',
  }] : [])];
  const point = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
  return {
    standee: (x: number, y: number, height = 64) => enabled ? standeeLighting(hours, point(x, y), height, lights) : NEUTRAL_STANDEE_LIGHTING,
    surface: (x: number, y: number): CSSProperties => {
      if (!enabled) return { '--surface-light': 'transparent', '--surface-brightness': 1, '--table-object-shadow': 'none' } as CSSProperties;
      const position = point(x, y);
      const sample = sampleTableLight(hours, position, lights);
      const lit = standeeLighting(hours, position, 32, lights);
      return {
        '--surface-light': rgba(lit.rim?.color ?? lit.lightColor, 0.12 + sample.local * 0.18),
        '--surface-angle': `${lit.rim ? Math.atan2(lit.rim.x, -lit.rim.y) * 180 / Math.PI : 135}deg`,
        '--surface-brightness': globalLightsEnabled() ? 0.72 + sample.total * 0.28 : 1,
        '--table-object-shadow': tableObjectShadow(hours, position, 8, lights),
      } as CSSProperties;
    },
  };
}
export type TableauLightRig = ReturnType<typeof createTableauLightRig>;

export type TableauLamp = { x: number; y: number; radius: number };
/** Screen-space foundation light; separate from the world's gameplay lights. */
export function tableauCardBrightness(ambient: number, point: { x: number; y: number }, lamps: readonly TableauLamp[]) {
  let unlit = 1;
  for (const lamp of lamps) {
    const distance = Math.min(1, Math.hypot(point.x - lamp.x, point.y - lamp.y) / lamp.radius);
    const falloff = (1 - distance * distance) ** 2;
    unlit *= 1 - .94 * falloff;
  }
  const total = ambient + (1 - ambient) * (1 - unlit);
  return .4 + .6 * Math.sqrt(total);
}
