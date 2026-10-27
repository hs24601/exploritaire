import { describe, expect, it } from 'vitest';
import { createDayOneState, createDayTwoState } from './dayScenarios';
import { dayOneDepartureCamera, departureEye, matchesDeparture, sampleDepartureCamera } from './departureCamera';
import { shotFromCamera } from './cameraChoreography';

describe('Day 01 first-bush departure camera', () => {
  it('targets only Hero leaving the authored den for its sparse bush', () => {
    const state=createDayOneState(), config=dayOneDepartureCamera(state)!;
    expect(matchesDeparture(config,'hero',[config.origin,config.destination])).toBe(true);
    expect(matchesDeparture(config,'banks',[config.origin,config.destination])).toBe(false);
    expect(matchesDeparture(config,'hero',[config.destination,config.origin])).toBe(false);
    expect(dayOneDepartureCamera(createDayTwoState())).toBeUndefined();
    expect(dayOneDepartureCamera({...state,biomeTiles:state.biomeTiles.map(t=>t.id===state.dayScenarioTiles?.sparsePatchId?{...t,berryHarvested:true}:t)})).toBeUndefined();
    expect(config.shot).toMatchObject({x:-11.4,y:58.7,scale:9.1,yaw:217.2,pitch:52,framing:.24});
  });
  it('holds the physical eye while turning to follow actual incremental actor positions', () => {
    const config=dayOneDepartureCamera(createDayOneState())!, height=720, eye=departureEye(config.shot,height);
    const initial={...config.shot,scale:9.935,yaw:186.4,pitch:82};
    for(const progress of [0,.25,.5,.75,1]){
      const actor={x:config.origin.x+(config.destination.x-config.origin.x)*progress,y:config.origin.y+(config.destination.y-config.origin.y)*progress};
      const frame=sampleDepartureCamera(config,initial,actor,2000,height);
      const actual=departureEye(shotFromCamera(frame,true,frame.pitch!),height);
      expect(actual.x).toBeCloseTo(eye.x,8);expect(actual.y).toBeCloseTo(eye.y,8);expect(actual.z).toBeCloseTo(eye.z,8);
    }
    const start=sampleDepartureCamera(config,initial,config.origin,0,height);
    expect(start.scale).toBe(initial.scale);expect(start.pitch).toBe(initial.pitch);
    const reduced=sampleDepartureCamera(config,initial,config.origin,0,height,true);
    expect(reduced.scale).toBeCloseTo(config.shot.scale);expect(reduced.pitch).toBeCloseTo(config.shot.pitch);
  });
});
