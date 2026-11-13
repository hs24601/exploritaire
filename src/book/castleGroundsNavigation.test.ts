import {describe, expect, it} from 'vitest';
import {CASTLE} from './castleLayout';
import {GROUNDS_START, groundsWalkable} from './castleGroundsLayout';
import {CastleGroundsNavigation, groundsSegmentClear, planGroundsRoute} from './castleGroundsNavigation';
import {CastlePlatformMotion} from './castlePlatformMotion';

const dt = 1/60;
function travel(from: {x:number;z:number},to: {x:number;z:number}) {
  const hero = new CastlePlatformMotion(from.x,from.z), navigation = new CastleGroundsNavigation();
  expect(navigation.setDestination(hero,to)).toBe(true);
  let ran = false, sprinted = false, jumped = false;
  for (let i=0;i<3600 && navigation.destination;i++) {
    const intent = navigation.steer(hero,dt);
    hero.update(dt,{x:intent?.x??0,z:intent?.z??0,run:!!intent?.run,crouch:false,
      jumpPressed:!!intent?.jump,jumpHeld:!!intent,divePressed:false});
    ran ||= !!intent?.run; sprinted ||= hero.sprinting; jumped ||= !hero.grounded;
    expect(groundsWalkable(hero.x,hero.z)).toBe(true);
  }
  expect(navigation.destination).toBeUndefined();
  expect(Math.hypot(hero.x-to.x,hero.z-to.z)).toBeLessThan(.45);
  return {ran,sprinted,jumped};
}

describe('Page 118 ground navigation', () => {
  it('rejects water and masonry and routes across the drawbridge into the courtyard', () => {
    expect(planGroundsRoute(GROUNDS_START,{x:12,z:50})).toBeUndefined();
    expect(planGroundsRoute(GROUNDS_START,{x:12,z:34})).toBeUndefined();
    const start = {x:-16,z:65}, goal = {x:4,z:24};
    const route = planGroundsRoute(start,goal)!;
    expect(route.length).toBeGreaterThan(1);
    expect(route.every((p,i) => groundsSegmentClear(i ? route[i-1] : start,p,CASTLE.heroRadius))).toBe(true);
    travel(start,goal);
  });

  it('walks short trips and builds to a sprint in open ground', () => {
    expect(travel({x:-83,z:105},{x:-83,z:101})).toEqual({ran:false,sprinted:false,jumped:false});
    expect(travel({x:-83,z:105},{x:-83,z:54})).toEqual({ran:true,sprinted:true,jumped:false});
  });

  it('jumps onto a raised deck on a clear approach and traverses the outlet', () => {
    expect(travel({x:0,z:69},{x:0,z:22}).jumped).toBe(true);
    travel({x:20,z:72},{x:77,z:20});
  });

  it('steers around solid obstacles when the direct route is blocked', () => {
    travel({x:-23,z:-14},{x:23,z:-14});
    travel({x:38,z:98},{x:48,z:98});
  });

  it('reaches a click beside masonry with enough clearance for Hero', () => {
    const face = CASTLE.keep.half/Math.SQRT2;
    const offset = .54/Math.SQRT2;
    travel({x:face+2,z:CASTLE.keep.z+face+2},
      {x:face+offset,z:CASTLE.keep.z+face+offset});
  });
});
