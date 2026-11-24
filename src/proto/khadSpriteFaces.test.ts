import { expect, it } from 'vitest';
import { selectKhadFace } from './khadSpriteFaces';
const rad=(n:number)=>n*Math.PI/180;
it('holds a face inside a sector and crosses it only beyond the hysteresis margin',()=>{
  const front=selectKhadFace(0,0,8);
  expect(selectKhadFace(rad(24),0,8,front).sector).toBe(0);
  const quarter=selectKhadFace(rad(27),0,8,front);
  expect(quarter.sector).toBe(1);
  expect(selectKhadFace(rad(21),0,8,quarter).sector).toBe(1);
  expect(selectKhadFace(rad(18),0,8,quarter).sector).toBe(0);
});
it('wraps around the rear without oscillating and supports different face counts',()=>{
  const rear=selectKhadFace(rad(179),0,8);
  expect(selectKhadFace(rad(-179),0,8,rear).sector).toBe(rear.sector);
  expect(selectKhadFace(rad(35),0,4).yaw).toBe(0);
  expect(selectKhadFace(rad(35),0,16).yaw).toBeCloseTo(rad(45));
});
it('uses the same low/high/top elevation hysteresis as Hero',()=>{
  const low=selectKhadFace(0,rad(20),8);
  expect(selectKhadFace(0,rad(42),8,low).tier).toBe('low');
  const high=selectKhadFace(0,rad(45),8,low);
  expect(high.tier).toBe('high');
  expect(selectKhadFace(0,rad(74),8,high).tier).toBe('high');
  expect(selectKhadFace(0,rad(78),8,high).tier).toBe('top');
});
