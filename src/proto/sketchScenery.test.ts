import { describe, expect, it } from 'vitest';
import { adjacentSketchProgress, sketchBorderProps } from './sketchScenery';
import { walkableSceneryOwner, fitSceneryVolumeFootprint } from './sceneryFootprint';

describe('sketch border relief', () => {
  it('develops both side neighbors from persistent crossing progress, without mutating them', () => {
    const tiles = [-48,0,48].map((x,i) => ({id:String(i),position:{x,y:48},traversalProgress:i===1?.7:0}));
    expect(adjacentSketchProgress(tiles[0],tiles,48)).toBe(.7);
    expect(adjacentSketchProgress(tiles[2],tiles,48)).toBe(.7);
    expect(tiles[0].traversalProgress).toBe(0);
    expect(adjacentSketchProgress({...tiles[0],position:{x:-48,y:0}},tiles,48)).toBe(0);
    expect(adjacentSketchProgress(tiles[0],[{...tiles[1],flags:['unexplored']}],48)).toBe(0);
    expect(adjacentSketchProgress(tiles[0],[{...tiles[1],unlocked:false}],48)).toBe(0);
  });
  const area = { x: 0, y: 0, width: 48, height: 48 };
  const props = Array.from({length: 6}, (_,i) => ({ id: String(i), edge: 'front' as const, src: 'tree', x: 0, y: 0, width: 20, height: 30, flip: false }));
  it.each([[0,48,'y',1],[0,-48,'y',-1],[48,0,'x',1],[-48,0,'x',-1]] as const)('fits trees on the approach border from %s,%s', (x,y,axis,sign) => {
    const result = sketchBorderProps(props,area,{x,y});
    expect(result).toHaveLength(2);
    for (const prop of result) {
      const foot = {x:prop.x,y:prop.y};
      const fitted = fitSceneryVolumeFootprint(foot,prop.width,prop.height,walkableSceneryOwner(foot,area));
      expect(fitted.position[axis]*sign).toBeGreaterThan(15);
      expect(Math.abs(fitted.position[axis === 'x' ? 'y' : 'x'])).toBeGreaterThan(8);
    }
  });
});
