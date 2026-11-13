import {describe, expect, it} from 'vitest';
import {CastlePlatformMotion, PLATFORM_MOTION, platformAirFrame, type PlatformInput} from './castlePlatformMotion';
import {groundsHeight, groundsWalkable} from './castleGroundsLayout';

const neutral: PlatformInput = {x:0,z:0,run:false,crouch:false,jumpPressed:false,jumpHeld:false,divePressed:false};
const run = {...neutral,z:-1,run:true};
it('holds an explicit manual sprint and returns to run speed on release without changing timed sprint',()=>{
 const surface={height:()=>0,wall:()=>false,move:(x:number,z:number,dx:number,dz:number)=>({x:x+dx,z:z+dz})};
 const hero=new CastlePlatformMotion(0,0,0,surface);
 for(let i=0;i<480;i++)hero.update(1/120,{...run,sprint:false,sustainSprint:false});
 expect(hero.sprinting).toBe(false);expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run);
 for(let i=0;i<120;i++)hero.update(1/120,{...run,sprint:true,sustainSprint:false});
 expect(hero.sprinting).toBe(true);expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run*PLATFORM_MOTION.sprintMultiplier);expect(hero.grounded).toBe(true);
 for(let i=0;i<120;i++)hero.update(1/120,{...run,sprint:false,sustainSprint:false});
 expect(hero.sprinting).toBe(false);expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run);
 const automatic=new CastlePlatformMotion(0,0,0,surface);
 for(let i=0;i<480;i++)automatic.update(1/120,{...run,sustainSprint:false});
 expect(automatic.sprinting).toBe(true);
});
const press = (hero: CastlePlatformMotion,input = neutral) => hero.update(1/120,{...input,jumpPressed:true,jumpHeld:true});

function land(hero: CastlePlatformMotion,input: PlatformInput) {
  const keys = new Set<number>();
  let height = hero.y, apexFrame = -1;
  for (let i=0;i<200 && !hero.grounded;i++) {
    const frame = platformAirFrame(hero);
    keys.add(frame);
    if (hero.y>height) { height = hero.y; apexFrame = frame; }
    hero.update(1/120,{...input,jumpHeld:true});
  }
  expect(hero.grounded).toBe(true);
  return {height,keys,apexFrame};
}

describe('Page 118 platform motion', () => {
  it('raises the speed cap by 50% after three seconds of running', () => {
    const hero = new CastlePlatformMotion(-83,105);
    hero.update(2.99,run);
    expect(hero.sprinting).toBe(false);
    expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run);
    hero.update(.011,run);
    expect(hero.sprinting).toBe(true);
    hero.update(.25,run);
    expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run*1.5);
    hero.update(.01,neutral);
    expect(hero.sprinting).toBe(true);
    expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.run*1.5);
  });

  it('holds sprint speed and world direction after releasing run and movement', () => {
    const hero = new CastlePlatformMotion(-83,105);
    hero.update(3.3,run);
    hero.update(.2,{...run,run:false});
    const before = hero.z;
    hero.update(.5,neutral);
    expect(hero.sprinting).toBe(true);
    expect(hero.speed).toBeCloseTo(10.8);
    expect(hero.z).toBeCloseTo(before-5.4);
    expect(hero.x).toBeCloseTo(-83);
    hero.update(.1,{...neutral,x:1});
    expect(hero.sprinting).toBe(false);
    hero.update(.7,{...neutral,x:1});
    expect(hero.speed).toBeCloseTo(PLATFORM_MOTION.walk);
  });

  it('ignores camera-only steering until fresh directional input takes over', () => {
    const hero = new CastlePlatformMotion(-83,105);
    hero.update(3.3,run);
    hero.update(.1,{...neutral,x:1,directionChanged:false});
    expect(hero.sprinting).toBe(true);
    expect(hero.vx).toBeCloseTo(0);
    expect(hero.vz).toBeCloseTo(-10.8);
    hero.update(.1,{...neutral,x:1,directionChanged:true});
    expect(hero.sprinting).toBe(false);
    expect(hero.vx).toBeGreaterThan(0);
  });

  it('preserves a sprint through a jump but yields to crouch, routes and explicit stopping', () => {
    const hero = new CastlePlatformMotion(-83,105);
    hero.update(3.3,run); press(hero);
    hero.update(.1,{...neutral,jumpHeld:true});
    expect(hero.sprinting).toBe(true);
    expect(hero.speed).toBeCloseTo(10.8);
    hero.update(.02,{...neutral,crouch:true});
    expect(hero.sprinting).toBe(false);
    const route = new CastlePlatformMotion(-83,105);
    route.update(3.3,run);route.update(.1,{...neutral,sustainSprint:false});
    expect(route.sprinting).toBe(false);
    route.cancelSprint(true);expect(route.speed).toBe(0);
  });

  it('chains three landing-timed jumps, gaining height and inverting at the third apex', () => {
    // Use the flat stretch beside the moat to isolate the jump arc from grade.
    const hero = new CastlePlatformMotion(-83,68);
    hero.update(.6,run);
    const jumps = [1,2,3].map(number => {
      press(hero,run);
      expect(hero.jumpNumber).toBe(number);
      return land(hero,run);
    });
    expect(jumps[0].height).toBeCloseTo(1.10);
    expect(jumps[1].height).toBeCloseTo(2.80);
    expect(jumps[2].height).toBeCloseTo(6.24);
    expect(jumps[2].apexFrame).toBe(9);
    expect([...jumps[2].keys]).toEqual([6,7,8,9,10,11]);
    press(hero,run);
    expect(hero.jumpNumber).toBe(1);
  });

  it('keeps Hero grounded while crossing onto the sloped approach', () => {
    const hero = new CastlePlatformMotion(-30,68);
    hero.update(2,{...neutral,z:1});
    expect(hero.z).toBeGreaterThan(73);
    expect(hero.grounded).toBe(true);
    expect(hero.y).toBeCloseTo((hero.z-70)*.10);
  });

  it('buffers a press near landing and expires a missed combo', () => {
    const hero = new CastlePlatformMotion(-83,105);
    press(hero);
    hero.update(.63,{...neutral,jumpHeld:true});
    press(hero);
    expect(hero.jumpNumber).toBe(1);
    hero.update(.12,{...neutral,jumpHeld:true});
    expect(hero.jumpNumber).toBe(2);
    land(hero,neutral);
    hero.update(.3,neutral);
    press(hero);
    expect(hero.jumpNumber).toBe(1);
  });

  it('uses the shoreline sweep in the air and never treats water as a kickable wall', () => {
    const hero = new CastlePlatformMotion(0,49);
    const right = {...neutral,x:1,run:true,jumpHeld:true};
    hero.update(.2,right);
    press(hero,right);
    for (let i=0;i<50;i++) {
      hero.update(1/120,right);
      expect(groundsWalkable(hero.x,hero.z)).toBe(true);
    }
    press(hero,right);
    expect(hero.airMove).toBe('jump');
    land(hero,right);
    expect(hero.x).toBeLessThanOrEqual(3.15);
    expect(hero.y).toBe(groundsHeight(hero.x,hero.z));
  });

  it('kicks away from stone and supports a running reversal and aerial actions', () => {
    const wall = new CastlePlatformMotion(-30,0,-Math.PI/2);
    const left = {...neutral,x:-1,run:true,jumpHeld:true};
    wall.update(.15,left);
    press(wall,left);
    wall.update(.4,left);
    press(wall,left);
    expect(wall.airMove).toBe('wall');
    expect(wall.vx).toBeGreaterThan(0);

    const hero = new CastlePlatformMotion(-83,105);
    hero.update(.6,run);
    press(hero,{...run,z:1});
    expect(hero.airMove).toBe('side');
    land(hero,neutral);
    press(hero);
    hero.update(.15,{...neutral,jumpHeld:true});
    hero.update(.04,{...neutral,crouch:true});
    expect(hero.airMove).toBe('pound');
    land(hero,neutral);
    press(hero);
    hero.update(.15,{...neutral,jumpHeld:true});
    hero.update(.03,{...neutral,divePressed:true});
    expect(hero.airMove).toBe('dive');
  });
});
