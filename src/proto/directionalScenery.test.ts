import {describe,expect,it} from 'vitest';
import {DEN_ORBIT_FILES,directionalScenery,selectSceneryView} from './directionalScenery';
import {isPaintedScenerySprite,sceneryWorldHeading} from './sceneryArt';
import {propVolumeRecipe} from './propVolume';

describe('painted den orbit views',()=>{
  const definition=directionalScenery('/assets/biomes/watercolor-v1/hero-den-sprite-v2.png')!;
  it('shows a closed rear, both sides and the north-facing entrance across the full orbit',()=>{
    const expected=[['rear',false],['rear-quarter',true],['side',true],['front-quarter',true],['sprite-v2',false],['front-quarter',false],['side',false],['rear-quarter',false],['rear',false]] as const;
    expected.forEach(([name,flip],index)=>{
      const selected=selectSceneryView(definition,index*45);
      expect(selected.src).toContain(`hero-den-${name}`);expect(selected.flip).toBe(flip);
    });
    expect(selectSceneryView(definition,-90)).toEqual(selectSceneryView(definition,270));
    expect(definition.heading).toBe(Math.PI);
  });
  it('holds the current view near a boundary instead of flickering during orbit',()=>{
    const previous={direction:0,elevation:'low' as const,flip:1};
    expect(selectSceneryView(definition,204,previous).direction).toBe(0);
    expect(selectSceneryView(definition,208,previous).direction).toBe(1);
  });
  it('keeps every authored painting smooth and unvoxelized while preserving unrelated scenery',()=>{
    for(const file of DEN_ORBIT_FILES){
      expect(isPaintedScenerySprite(file)).toBe(true);expect(propVolumeRecipe(file)).toBeUndefined();
      expect(sceneryWorldHeading(file)).toBe(Math.PI);
      expect(directionalScenery(file)?.views).toHaveLength(5);
    }
    expect(directionalScenery('hero-den-standee-v3.png')).toBeUndefined();
    expect(directionalScenery('pine-sprite-v1.png')).toBeUndefined();
  });
});
