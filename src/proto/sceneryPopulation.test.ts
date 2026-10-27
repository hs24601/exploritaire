import {describe,it,expect} from 'vitest';
import {populateScenery,sceneryReliefRise,sparseBerryBush} from './sceneryPopulation';
describe('tile population',()=>{
  it('places the sparse bush on the incoming side with clearance beside the actor lane',()=>{
    for(const horizontal of [true,false])for(const sign of [-1,1]){
      const bush=sparseBerryBush('single-bush',48,48,{horizontal,sign});
      expect(Math.sign(horizontal?bush.x:bush.y)).toBe(sign);
      expect(Math.abs(horizontal?bush.y:bush.x)).toBeGreaterThan(8);
      expect(Math.abs(bush.x)+bush.width/2).toBeLessThan(24);
      expect(Math.abs(bush.y)).toBeLessThan(24);
    }
  });
  const prop={id:'tree',edge:'front' as const,src:'pine',x:0,y:0,width:24,height:36,flip:false};
  it('controls count deterministically and keeps travel lanes clear',()=>{
    expect(populateScenery(prop,0,48,48)).toHaveLength(0);
    expect(populateScenery(prop,3,48,48)).toHaveLength(6);
    expect(populateScenery(prop,10,48,48)).toHaveLength(20);
    const dense=populateScenery(prop,10,48,48);
    expect(dense).toEqual(populateScenery(prop,10,48,48));
    expect(dense.every(p=>Math.abs(p.x)>=4&&Math.abs(p.y)>=4)).toBe(true);
    expect(dense.some(p=>Math.abs(p.x)<10&&Math.abs(p.y)<10)).toBe(true);
    expect(new Set(dense.map(p=>Math.round(p.y/4))).size).toBeGreaterThan(5);
    expect(populateScenery(prop,6,48,48,{horizontal:true,sign:-1}).every(p=>p.x<0)).toBe(true);
  });
  it('raises pine relief but retains sapling and mountain scales',()=>{
    expect(sceneryReliefRise('/pine-sprite-v1.png')).toBe(3);
    expect(sceneryReliefRise('/pine-edge-relief-v1.png')).toBe(3);
    expect(sceneryReliefRise('/curious-sapling-sprite-v1.png')).toBe(1);
    expect(sceneryReliefRise('/mountain-peak-sprite-v1.png')).toBe(1);
  });
});
