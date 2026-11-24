import {describe,it,expect} from 'vitest';
import {woodsRoughage} from './woodsRoughage';
describe('woods roughage',()=>{
 it('keeps debris contained and between one and two height units',()=>{
  for(const f of [{x:-144,y:48,width:48,height:48},{x:200,y:-100,width:144,height:96}]){
   const litter=woodsRoughage('woods',f);
   expect(litter).toEqual(woodsRoughage('woods',f));
   expect(new Set(litter.map(d=>d.id)).size).toBe(24);
   for(const d of litter){expect(d.relief).toBeGreaterThanOrEqual(1);expect(d.relief).toBeLessThanOrEqual(2);expect(Math.abs(d.x-f.x)+d.size/2).toBeLessThanOrEqual(f.width/2);expect(Math.abs(d.y-f.y)+d.size/2).toBeLessThanOrEqual(f.height/2);}
  }
 });
});
