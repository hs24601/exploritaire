import { describe, expect, it } from 'vitest';
import { cinematicTravelCamera, followingCamera, travelDuration, travelSpeedBudget } from './travelMotion';
import { rotateVector } from '../hooks/useCameraControls';

describe('travel motion', () => {
  it('keeps cinematic shots bounded over a long incremental journey', () => {
    let camera = { x: -216, y: -432, scale: 4.5, yaw: 180, pitch: 60 };
    for (let time = 0; time < 120000; time += 16) {
      camera = cinematicTravelCamera({ x: 48, y: 96 }, 0, camera, 16, time, 3) as typeof camera;
      expect(camera.scale).toBeGreaterThanOrEqual(3.75);
      expect(camera.scale).toBeLessThanOrEqual(4.5);
      expect(camera.yaw).toBeGreaterThanOrEqual(142);
      expect(camera.yaw).toBeLessThanOrEqual(218);
      expect(camera.pitch).toBeGreaterThanOrEqual(55);
      expect(camera.pitch).toBeLessThanOrEqual(65);
    }
    expect(camera.x / camera.scale).toBeCloseTo(-48, 0);
    expect(camera.y / camera.scale).toBeCloseTo(-96, 0);
  });
  it('uses a steady reduced-motion party shot independent of shot time', () => {
    const from = { x: 0, y: 0, scale: 1.7, yaw: 179 };
    expect(cinematicTravelCamera({ x: 48, y: 96 }, 0, from, 16, 0, 3, true))
      .toEqual(cinematicTravelCamera({ x: 48, y: 96 }, 0, from, 16, 60000, 3, true));
  });
  it('uses the selected speed immediately and throughout travel', () => {
    for (const speed of [5, 100, 300, 500]) {
      expect(travelSpeedBudget(0, 16, speed)).toBe(speed * 16);
      expect(travelSpeedBudget(0, 3000, speed)).toBe(speed * 3000);
      expect(travelSpeedBudget(3000, 4000, speed)).toBe(speed * 1000);
    }
  });
  it('applies live speed edits to subsequent frames', () => {
    expect(travelSpeedBudget(0, 1000, 100) + travelSpeedBudget(1000, 2000, 500)).toBe(600000);
  });
  it('calibrates 100% to three times the former duration, including short trips', () => {
    for (const cost of [0, 48, 192, 640]) {
      const former = Math.max(300, cost / 320 * 1000);
      expect(travelDuration(cost)).toBe(former * 3);
      expect(travelDuration(cost) / 3).toBe(former);
      expect(travelDuration(cost) / .05).toBe(former * 60);
    }
  });
  it('looks from behind each movement direction at the requested zoom', () => {
    for (const heading of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      const camera = followingCamera({ x: 48, y: 96 }, heading, { x: 0, y: 0, scale: 1.7 }, 5.1, 16, true);
      const direction = rotateVector({ x: Math.sin(heading), y: Math.cos(heading) }, camera.yaw!);
      expect(direction.x).toBeCloseTo(0);
      expect(direction.y).toBeCloseTo(-1);
      expect(camera.scale).toBe(5.1);
      expect(camera.x).toBeCloseTo(-48 * 5.1);
      expect(camera.y).toBeCloseTo(-96 * 5.1);
    }
  });
  it('turns across the wrap by the shortest arc and uses frame-independent easing', () => {
    const from = { x: 0, y: 0, scale: 1.7, yaw: 179 };
    const heading = -359 * Math.PI / 180;
    const half = followingCamera({ x: 0, y: 0 }, heading, from, 5.1, 8);
    const twice = followingCamera({ x: 0, y: 0 }, heading, half, 5.1, 8);
    const once = followingCamera({ x: 0, y: 0 }, heading, from, 5.1, 16);
    expect(once.yaw).toBeGreaterThan(179);
    expect(once.yaw).toBeLessThan(181);
    expect(twice.yaw).toBeCloseTo(once.yaw!);
    expect(twice.scale).toBeCloseTo(once.scale);
  });
});


import { advanceTravelBuffer, immersiveTileScale } from './travelMotion';
describe('earned travel buffer',()=>{
 it('accelerates, brakes and conserves earned distance',()=>{
   let position=0,speed=0;const speeds:number[]=[];
   for(let i=0;i<2000;i++){const next=advanceTravelBuffer(position,speed,16,16);expect(next.position).toBeGreaterThanOrEqual(position);expect(next.position).toBeLessThanOrEqual(16);expect(Math.abs(next.speed-speed)).toBeLessThanOrEqual(.065);position=next.position;speed=next.speed;speeds.push(speed);}
   expect(position).toBe(16);expect(speed).toBe(0);expect(Math.max(...speeds)).toBeGreaterThan(3);expect(speeds[0]).toBeLessThan(.06);
 });
 it('larger earned buffers build greater speed without motion on unearned distance',()=>{
   let short={position:0,speed:0},long={position:0,speed:0};for(let i=0;i<200;i++){short=advanceTravelBuffer(short.position,short.speed,4,16);long=advanceTravelBuffer(long.position,long.speed,48,16);}
   expect(long.speed).toBeGreaterThan(short.speed);expect(advanceTravelBuffer(4,0,4,1000)).toEqual({position:4,speed:0});expect(advanceTravelBuffer(4,8,48,16,true)).toEqual({position:4,speed:0});
 });
 it('fills the ground viewport and uses a steady shoulder camera',()=>{
   const scale=immersiveTileScale(1912);expect(scale*48).toBeGreaterThan(1912);
   const frame=cinematicTravelCamera({x:0,y:0},Math.PI,{x:0,y:0,scale:1.7},16,0,1,true,true,1912);
   expect(frame.scale).toBe(scale);expect(frame.pitch).toBe(82);expect(frame.yaw).toBe(0);
 });
});

it('keeps the shoulder anchor locked to the live actor through acceleration, turns and zoom settling',()=>{
 let camera={x:700,y:-300,scale:1.7,yaw:80,pitch:60};
 for(let frame=0;frame<240;frame++){
   const position={x:frame<100?0:(frame-100)*.3,y:96-Math.min(frame,100)*.2};
   camera=cinematicTravelCamera(position,frame<100?Math.PI:Math.PI/2,camera,16,frame*16,1,false,true,1280) as typeof camera;
   const screen=rotateVector({x:camera.x+position.x*camera.scale,y:camera.y+position.y*camera.scale},camera.yaw);
   expect(screen.x).toBeCloseTo(0,9);expect(screen.y).toBeCloseTo(0,9);
 }
});

it('keeps shoulder distance static while sweeping slowly enough for card input',()=>{
 const scale=immersiveTileScale(1280);let camera={x:0,y:0,scale,yaw:0,pitch:82},minYaw=0,maxYaw=0;
 for(let t=0;t<120000;t+=16){const next=cinematicTravelCamera({x:0,y:0},Math.PI,camera,16,t,1,false,true,1280) as typeof camera;
 expect(next.scale).toBe(scale);expect(Math.abs(next.yaw-camera.yaw)).toBeLessThan(.004);expect(next.pitch).toBeGreaterThanOrEqual(81.1);expect(next.pitch).toBeLessThanOrEqual(82);camera=next;minYaw=Math.min(minYaw,camera.yaw);maxYaw=Math.max(maxYaw,camera.yaw);}
 expect(minYaw).toBeLessThan(-2.8);expect(maxYaw).toBeGreaterThan(2.8);
});
