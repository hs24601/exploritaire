import {describe, expect, it} from 'vitest';
import {CASTLE, FLIGHT_SECONDS, SHOULDER, SURFACE, sampleFlight, shoulderPose} from './castleLayout';
import {GROUNDS_BRIDGES, GROUNDS_FLIGHT, GROUNDS_SHOULDER, GROUNDS_START, groundsHeight, groundsWalkable, resolveGroundsMove} from './castleGroundsLayout';

describe('Page 118 castle grounds', () => {
  it('shares the castle fly-in opening and descends smoothly to the drawbridge follow camera', () => {
    expect(sampleFlight(0,GROUNDS_FLIGHT)).toEqual(sampleFlight(0));
    const {x,z} = GROUNDS_START;
    const rest = shoulderPose(x,z,0,GROUNDS_SHOULDER.pitch,GROUNDS_SHOULDER.distance,groundsHeight(x,z));
    const end = sampleFlight(FLIGHT_SECONDS,GROUNDS_FLIGHT);
    expect(end.position).toEqual(rest.position.map(value=>expect.closeTo(value,8)));
    expect(end.target).toEqual(rest.target.map(value=>expect.closeTo(value,8)));
    expect(end).toMatchObject({fov:SHOULDER.fov,done:true});
    let lastZ = Infinity;
    for (let t=0;t<=FLIGHT_SECONDS;t+=1/120) {
      const [cx,cy,cz] = sampleFlight(t,GROUNDS_FLIGHT).position;
      expect(cz).toBeLessThanOrEqual(lastZ);
      expect(cy).toBeGreaterThan(groundsHeight(cx,cz)+1);
      lastZ=cz;
    }
  });

  it('starts Hero on the outer end of the drawbridge and lets her enter the gate', () => {
    expect(groundsWalkable(GROUNDS_START.x,GROUNDS_START.z)).toBe(true);
    expect(groundsHeight(GROUNDS_START.x,GROUNDS_START.z)).toBe(SURFACE.bridge);
    expect(resolveGroundsMove(0,GROUNDS_START.z,0,-32)).toMatchObject({x:0,z:expect.closeTo(27.45)});
    expect(groundsWalkable(13,34)).toBe(false);
  });

  it('crosses both water channels along the full deck and its landings', () => {
    for (const {from,to} of GROUNDS_BRIDGES) {
      for (let t = .05; t < .99; t += .05) {
        const x = from[0]+(to[0]-from[0])*t, z = from[1]+(to[1]-from[1])*t;
        expect(groundsWalkable(x,z),`bridge at ${x},${z}`).toBe(true);
        expect(groundsHeight(x,z)).toBe(SURFACE.bridge);
      }
      expect(resolveGroundsMove(from[0],from[1],to[0]-from[0],to[1]-from[1]))
        .toEqual({x:expect.closeTo(to[0]),z:expect.closeTo(to[1])});
    }
  });

  it('blocks the moat, inlet and outlet with a full-radius shoreline inset', () => {
    for (const [x,z] of [[15,50],[-80,-56],[68,81],[110,130]]) {
      expect(groundsWalkable(x,z),`water or shoreline at ${x},${z}`).toBe(false);
    }
    expect(groundsWalkable(10,57.2,0)).toBe(true);
    expect(groundsWalkable(10,57.2)).toBe(false);
    expect(groundsWalkable(10,57+CASTLE.heroRadius+.1)).toBe(true);
  });

  it('sweeps large steps and keeps Hero on a deck or dry ground during diagonal movement', () => {
    const stopped = resolveGroundsMove(15,60,0,-22);
    expect(stopped.z).toBeGreaterThanOrEqual(57+CASTLE.heroRadius);
    expect(stopped.z).toBeLessThan(58);
    const side = resolveGroundsMove(0,49,12,2);
    expect(side.x).toBeLessThanOrEqual(CASTLE.bridgeHalf-CASTLE.heroRadius);
    expect(side.z).toBeGreaterThan(50);
    expect(groundsWalkable(side.x,side.z)).toBe(true);
  });
});
