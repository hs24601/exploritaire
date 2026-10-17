import {expect,it} from 'vitest';
import {actorCloseupCamera,actorCloseupTilt,type ActorCloseup} from './actorCloseup';
import {rotateVector} from '../hooks/useCameraControls';
import {projectTilt,unprojectTilt} from './tableTilt';

it('keeps live world positions at the actor orbit pivot at any yaw and magnification',()=>{
  for(const position of [{x:0,y:96},{x:-144,y:48},{x:96,y:-240}])
    for(const yaw of [0,45,-90,270]) for(const scale of [1.7,6.8,40.8]) {
      const camera=actorCloseupCamera(position,{x:800,y:-300,scale,yaw});
      const centered=rotateVector({x:position.x*scale+camera.x,y:position.y*scale+camera.y},yaw);
      expect(centered.x).toBeCloseTo(0);expect(centered.y).toBeCloseTo(0);
      expect(camera.scale).toBe(scale);expect(camera.yaw).toBe(yaw);
    }
});

it('holds elevation and authored body scale while projecting a magnified shared scene',()=>{
  const closeup:ActorCloseup={camera:{x:0,y:0,scale:6.8},tilted:true,actorId:'hero',angle:82,actorScale:.25};
  for(const height of [720,914]) for(const factor of [1,3,6]) {
    const scale=closeup.camera.scale*factor,tilt=actorCloseupTilt(height,scale,closeup);
    expect(tilt.perspective / scale).toBeCloseTo(Math.max(600,height*1.6)/closeup.camera.scale);
    expect(tilt.angle).toBe(82);expect(closeup.actorScale).toBe(.25);
    expect(tilt.aimY! / scale).toBeCloseTo(16*.25*Math.sin(82*Math.PI/180));
    const plane={x:-120,y:-280},back=unprojectTilt(projectTilt(plane,tilt),tilt);
    expect(back.x).toBeCloseTo(plane.x);expect(back.y).toBeCloseTo(plane.y);
  }
});

it('supports manual photo tilt while zoom retains focal length and actor anchoring',()=>{
  const closeup:ActorCloseup={camera:{x:0,y:0,scale:1.7},tilted:true,actorId:'hero',angle:60,actorScale:1};
  for(const pitch of [0,35,82]) for(const factor of [1,3,6]) {
    const scale=1.7*factor,tilt=actorCloseupTilt(720,scale,closeup,pitch);
    expect(tilt.angle).toBe(pitch);
    expect(tilt.perspective/scale).toBeCloseTo(720*1.6/1.7);
    expect(tilt.aimY!/scale).toBeCloseTo(16*Math.sin(pitch*Math.PI/180));
    const point={x:120,y:-300},back=unprojectTilt(projectTilt(point,tilt),tilt);
    expect(back.x).toBeCloseTo(point.x);expect(back.y).toBeCloseTo(point.y);
  }
});
