import type { CSSProperties } from 'react';
import { rgba, sampleTableLight, standeeLighting, tableObjectShadow, type TableLight } from './protoLighting';

/** A local view of the biome's world lighting; the fixture is visual scaffolding
 * for this field only and never changes table exploration or gameplay light. */
export function createTableauLightRig(hours: number, origin: { x: number; y: number }, worldLights: readonly TableLight[], fixture = true) {
  const lights: TableLight[] = [...worldLights, ...(fixture ? [{
    id: 'tableau-overhead', position: { x: origin.x, y: origin.y - 90 },
    height: 180, radius: 5, strength: 0.72, color: '#ffe0a0',
  }] : [])];
  const point = (x: number, y: number) => ({ x: origin.x + x, y: origin.y + y });
  return {
    standee: (x: number, y: number, height = 64) => standeeLighting(hours, point(x, y), height, lights),
    surface: (x: number, y: number): CSSProperties => {
      const position = point(x, y);
      const sample = sampleTableLight(hours, position, lights);
      const lit = standeeLighting(hours, position, 32, lights);
      return {
        '--surface-light': rgba(lit.rim?.color ?? lit.lightColor, 0.12 + sample.local * 0.18),
        '--surface-angle': `${lit.rim ? Math.atan2(lit.rim.x, -lit.rim.y) * 180 / Math.PI : 135}deg`,
        '--surface-brightness': 0.72 + sample.total * 0.28,
        '--table-object-shadow': tableObjectShadow(hours, position, 8, lights),
      } as CSSProperties;
    },
  };
}
export type TableauLightRig = ReturnType<typeof createTableauLightRig>;
