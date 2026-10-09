import { describe,expect,it } from 'vitest';
import { AtmosphereBudget,atmospherePointAtHeight,atmosphereSky,projectAtmospherePoint,shaftIllumination } from './volumetricAtmosphere';
import { getTableLighting } from './protoLighting';
import { tableCameraTilt } from './tableTilt';

describe('visual atmospheric volume',()=>{
  it('keeps elevated air anchored through pan, zoom and spin',()=>{
    for(const yaw of [0,45,90,180,-75])for(const scale of [0.65,1.7,2.25,4.5,5.65,6.8])for(const height of [0,16,72,140]){
      const camera={x:125,y:-53,scale,yaw},tilt=tableCameraTilt(720,scale),world={x:-74,y:125};
      const screen=projectAtmospherePoint(world,height,camera,tilt);
      const recovered=atmospherePointAtHeight(screen,height,camera,tilt);
      expect(recovered.x).toBeCloseTo(world.x,8);expect(recovered.y).toBeCloseTo(world.y,8);
    }
  });
  it('crossfades the sky at sunrise and sunset instead of popping between colours',()=>{
    for(const hour of [6,18]){
      const before=atmosphereSky(getTableLighting(hour-0.001)),after=atmosphereSky(getTableLighting(hour+0.001));
      expect(Math.abs(before.color.r-after.color.r)).toBeLessThan(1);
      expect(Math.abs(before.color.b-after.color.b)).toBeLessThan(1);
      expect(Math.abs(before.strength-after.strength)).toBeLessThan(0.02);
    }
    expect(atmosphereSky(getTableLighting(12)).sun).toBe(1);
    expect(atmosphereSky(getTableLighting(0)).sun).toBe(0);
  });
  it('reduces only the atmosphere resolution under sustained load and recovers slowly',()=>{
    const budget=new AtmosphereBudget();
    for(let i=0;i<23;i++)budget.observe(45);
    expect(budget.scale).toBe(0.24);budget.observe(45);expect(budget.scale).toBeCloseTo(0.20);expect(budget.interval).toBe(67);
    for(let i=0;i<500;i++)budget.observe(45);expect(budget.scale).toBeCloseTo(0.12);
    for(let i=0;i<239;i++)budget.observe(16.7);expect(budget.scale).toBeCloseTo(0.12);
    budget.observe(16.7);expect(budget.scale).toBeCloseTo(0.14);expect(budget.interval).toBe(40);
    for(let i=0;i<3000;i++)budget.observe(16.7);expect(budget.scale).toBeCloseTo(0.28);
  });
  it('gives dust bright and dark parts of the same world-space shaft',()=>{
    const frame=getTableLighting(17);
    const samples=Array.from({length:200},(_,i)=>shaftIllumination({x:i*4-400,y:0},30,frame));
    expect(Math.max(...samples)).toBeGreaterThan(Math.min(...samples)*4);
    for(const sample of samples){expect(sample).toBeGreaterThanOrEqual(0);expect(sample).toBeLessThanOrEqual(1);}
  });
});
