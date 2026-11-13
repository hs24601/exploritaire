import {describe, expect, it} from 'vitest';
import {SURFACE, groundHeight, CASTLE, CASTLE_MAX_PITCH, FLIGHT_SECONDS, TOWER_CIRCLES, resolveMove, sampleFlight, shoulderPose, walkable} from './castleLayout';

const C_START_MIN = 180;
it('centers the controller boom directly behind Hero without changing ordinary shoulder poses',()=>{
 for(const yaw of [0,.7,Math.PI,4.9]){
  const x=4,z=74,pose=shoulderPose(x,z,yaw,.13,4.5,2,0),dx=pose.position[0]-x,dz=pose.position[2]-z;
  expect(dx*Math.cos(yaw)-dz*Math.sin(yaw)).toBeCloseTo(0);
  expect(dx*Math.sin(yaw)+dz*Math.cos(yaw)).toBeCloseTo(4.5*Math.cos(.13));
  expect(pose.position[1]).toBeCloseTo(2+1.35+4.5*Math.sin(.13));
 }
 expect(shoulderPose(0,0,0,0,5.4,0).position[0]).toBeCloseTo(.85);
});
describe('page 117 castle layout', () => {
  it('lets Hero stand in the courtyard, gate, bridge and field but not in stone or water', () => {
    expect(walkable(CASTLE.heroStart.x, CASTLE.heroStart.z)).toBe(true);
    expect(walkable(0, 33.5)).toBe(true);           // gate passage
    expect(walkable(0, 64)).toBe(true);             // drawbridge over the moat
    expect(walkable(0, 90)).toBe(true);             // field beyond
    expect(walkable(10, 33.5)).toBe(false);         // front wall
    expect(walkable(0, -14)).toBe(false);            // keep
    expect(walkable(0, 1)).toBe(false);              // the keep's front corner
    expect(walkable(12, -3)).toBe(true);             // beside the turned keep
    expect(walkable(25, 59)).toBe(false);           // moat
    expect(walkable(0, 400)).toBe(false);           // off the page
    for (const t of TOWER_CIRCLES) expect(walkable(t.x, t.z)).toBe(false);
  });

  it('slides along a wall instead of stopping', () => {
    const moved = resolveMove(20, 31, .5, 1);
    expect(moved.x).toBeCloseTo(20.5);
    expect(moved.z).toBe(31);
  });

  it('flies from the tabletop through the open gate and settles on the shoulder pose', () => {
    const start = sampleFlight(0), end = sampleFlight(FLIGHT_SECONDS);
    expect(start.position[2]).toBeGreaterThan(C_START_MIN);
    const rest = shoulderPose(CASTLE.heroStart.x, CASTLE.heroStart.z, 0);
    end.position.forEach((v, i) => expect(v).toBeCloseTo(rest.position[i], 5));
    expect(end.done).toBe(true);
    for (let s = 0; s <= FLIGHT_SECONDS; s += 1 / 120) {
      const [x, y, z] = sampleFlight(s).position;
      if (z > CASTLE.court - 1 && z < CASTLE.court + CASTLE.wallThick + 1) {
        expect(Math.abs(x)).toBeLessThan(CASTLE.gateHalf - .4);
        expect(y).toBeLessThan(CASTLE.gateHeight - 1);
        expect(y).toBeGreaterThan(.5);
      }
      for (const t of TOWER_CIRCLES) if (y < CASTLE.cornerTower.height + 20) expect(Math.hypot(x - t.x, z - t.z)).toBeGreaterThan(t.r + .5);
    }
  });

  it('stands Hero on the paving, the bridge deck or the meadow', () => {
    expect(groundHeight(CASTLE.heroStart.x, CASTLE.heroStart.z)).toBe(SURFACE.paving);
    expect(groundHeight(0, 33.5)).toBe(SURFACE.paving);
    expect(groundHeight(0, 64)).toBe(SURFACE.bridge);
    expect(groundHeight(0, 120)).toBe(SURFACE.meadow);
  });

  it('places the camera directly above Hero at full downward tilt', () => {
    const {position, target} = shoulderPose(1, 64, Math.PI / 3, CASTLE_MAX_PITCH);
    expect(position[0]).toBeCloseTo(1);
    expect(position[2]).toBeCloseTo(64);
    expect(target[0]).toBeCloseTo(1);
    expect(target[2]).toBeCloseTo(64);
    expect(target[1]).toBeCloseTo(SURFACE.bridge + .55);
    expect(position[1]).toBeGreaterThan(target[1]);
  });
});
