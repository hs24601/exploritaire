import {describe,expect,it} from 'vitest';
import {sceneryInterior} from './sceneryInterior';
import {DEN_ORBIT_FILES} from './directionalScenery';

describe('painted den interior registration',()=>{
  it('provides a visible mouth only for front and front-quarter views',()=>{
    expect(sceneryInterior(DEN_ORBIT_FILES[0])).toBeDefined();
    expect(sceneryInterior(DEN_ORBIT_FILES[1])).toBeDefined();
    for(const src of DEN_ORBIT_FILES.slice(2))expect(sceneryInterior(src)).toBeUndefined();
    expect(sceneryInterior('hero-den-standee-v3.png')).toBeUndefined();
  });
  it('keeps the resting body above the threshold on the original painting grid',()=>{
    for(const src of DEN_ORBIT_FILES.slice(0,2)){
      const profile=sceneryInterior('/assets/runtime/environment/watercolor/v1/'+src)!;
      const [x,y,width,height]=profile.actor,[canvasWidth,canvasHeight]=profile.canvas;
      expect(x).toBeGreaterThan(0);expect(y).toBeGreaterThan(0);
      expect(x+width).toBeLessThan(canvasWidth);expect(y+height).toBeLessThan(canvasHeight*.87);
      expect(profile.opening.length).toBeGreaterThan(8);
      expect(profile.opening.every(([px,py])=>px>=0&&px<=canvasWidth&&py>=0&&py<=canvasHeight)).toBe(true);
    }
  });
});
