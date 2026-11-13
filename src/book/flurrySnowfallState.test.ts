import {describe,it,expect} from 'vitest';
import {createFlurrySnowfallState} from './flurrySnowfallState';
describe('released companion snowfall',()=>{
 it('leaves falling flakes behind when the emitter moves',()=>{
  const snow=createFlurrySnowfallState(()=>.5);snow.step(.1,()=>0,{x:0,y:1,z:0});const old=snow.particles[0]!,x=old.x,y=old.y;
  snow.step(.1,()=>0,{x:20,y:1,z:0});expect(old.x).toBeCloseTo(x);expect(old.y).toBeLessThan(y);expect(snow.particles[1]!.x).toBeGreaterThan(19);
 });
 it('lands on actual ground, lightly accumulates, and melts after emissions stop',()=>{
  const snow=createFlurrySnowfallState(()=>.5),height=(x:number)=>x*.1;
  for(let i=0;i<100;i++)snow.step(.1,height,{x:1,y:1,z:0});expect(snow.diagnostics.settled).toBeGreaterThan(0);
  const settled=snow.particles.filter(p=>p?.ground);for(const p of settled)expect(p!.y).toBeCloseTo(height(p!.x)+.014);
  expect(snow.diagnostics.settled).toBeLessThanOrEqual(snow.groundLimit);
  for(let i=0;i<500;i++)snow.step(.1,height);expect(snow.diagnostics.falling).toBe(0);expect(snow.diagnostics.settled).toBe(0);
 });
 it('keeps snow still while paused and bounds both particle pools',()=>{
  const snow=createFlurrySnowfallState(()=>.5);for(let i=0;i<1000;i++)snow.step(.1,()=>0,{x:0,y:1,z:0});
  const before=JSON.stringify(snow.particles);snow.step(0,()=>0,{x:12,y:1,z:0});expect(JSON.stringify(snow.particles)).toBe(before);expect(snow.diagnostics.capacity).toBe(224);
 });
});
