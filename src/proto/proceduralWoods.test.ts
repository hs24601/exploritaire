import { afterEach, describe, expect, it } from 'vitest';
import { proceduralCluster, proceduralPine, proceduralWoodsGeneration, registerProceduralWoods, sceneryFileName } from './proceduralWoods';
import { isPaintedScenerySprite, paintPineSprite, scenerySprite, sceneryWorldHeading } from './sceneryArt';
import { SCENERY_HEIGHTS, sceneryHeightUnits } from './sceneryHeight';
import { sceneryReliefRise } from './sceneryPopulation';

const legacy = (name: string) => `${import.meta.env.BASE_URL}assets/deprecated/pixel/environment/${name}`;
const pines = ['blob:test/pine-0', 'blob:test/pine-1', 'blob:test/pine-2'], clusters = ['blob:test/cluster-0', 'blob:test/cluster-1'];

describe('procedural woods cutover', () => {
  afterEach(() => registerProceduralWoods({ pines: [], clusters: [] }));

  it('keeps the static cutouts until a bake lands (and after a failure)', () => {
    expect(proceduralPine('woods-alpha')).toBeUndefined();
    expect(scenerySprite(legacy('woods_side.svg'), 'paint', 'woods-alpha')).toMatch(/watercolor\/v1\/pine-sprite-v1\.png$/);
    expect(scenerySprite(legacy('small_woods_pines.png'), 'paint', 'woods-alpha')).toMatch(/watercolor\/v1\/woods-cluster-sprite-v1\.png$/);
    expect(paintPineSprite('day-one-tree')).toMatch(/pine-sprite-v1\.png$/);
  });

  it('resolves Paint pines and clusters to baked variants by stable key, varying across keys', () => {
    const before = proceduralWoodsGeneration();
    registerProceduralWoods({ pines, clusters });
    expect(proceduralWoodsGeneration()).toBeGreaterThan(before);
    const side = scenerySprite(legacy('woods_side.svg'), 'paint', 'woods-alpha');
    expect(pines).toContain(side);
    expect(scenerySprite(legacy('woods_side.svg'), 'paint', 'woods-alpha')).toBe(side);
    expect(clusters).toContain(scenerySprite(legacy('small_woods_pines.png'), 'paint', 'woods-alpha'));
    expect(paintPineSprite('day-one-tree')).toBe(proceduralPine('day-one-tree'));
    const keys = Array.from({ length: 24 }, (_, i) => `tile-${i}`);
    expect(new Set(keys.map(proceduralPine)).size).toBe(pines.length);
    expect(new Set(keys.map(proceduralCluster)).size).toBe(clusters.length);
  });

  it('leaves Pixel art and unrelated Paint scenery unchanged', () => {
    registerProceduralWoods({ pines, clusters });
    expect(scenerySprite(legacy('woods_side.svg'), 'pixel', 'woods-alpha')).toBe(legacy('woods_side.svg'));
    expect(scenerySprite(legacy('small_woods_pines.png'), 'pixel')).toBe(legacy('small_woods_pines.png'));
    expect(scenerySprite(legacy('mountain_standee.svg'), 'paint', 'x')).toMatch(/mountain-peak-sprite-v1\.png$/);
  });

  it('gives baked woods the treatment of the cutouts they replace', () => {
    registerProceduralWoods({ pines, clusters });
    for (const [src, name] of [[pines[1], 'pine-sprite-v1.png'], [clusters[0], 'woods-cluster-sprite-v1.png']] as const) {
      expect(sceneryFileName(src)).toBe(name);
      // Smooth-sampled, camera-facing painted cutout; woods height 8; raised crowns.
      expect(isPaintedScenerySprite(src)).toBe(true);
      expect(sceneryWorldHeading(src)).toBeUndefined();
      expect(sceneryHeightUnits(src)).toBe(SCENERY_HEIGHTS.woods);
      expect(sceneryReliefRise(src)).toBe(3);
    }
    expect(sceneryFileName('blob:http://localhost/unknown')).toBe('unknown');
  });
});
