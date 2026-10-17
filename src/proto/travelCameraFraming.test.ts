import {describe,it,expect} from 'vitest';
import {frameTravelCards,projectTravelFramePoint,travelFaceCorners} from './travelCameraFraming';
import {immersiveTileScale} from './travelMotion';
import type {CameraState} from '../hooks/useCameraControls';

describe('card-constrained travel composition',()=>{
  const stations=Array.from({length:7},(_,i)=>({x:(i%2?-1:1)*(3.5+Math.floor(i/2)*6),y:-24+(i+.5)*48/7,heading:0,elevation:[0,1.2,2.4,0,1.8,3,0][i]}));
  for(const view of [{width:1221,height:844},{width:1641,height:844},{width:1200,height:650}])it(`keeps all seven faces and the actor inside ${view.width}×${view.height}, including behind the actor`,()=>{
    let camera:CameraState={x:0,y:0,scale:immersiveTileScale(view.width),yaw:0,pitch:82,aimY:view.height*.28};
    for(let step=0;step<=240;step++){
      const actor={x:0,y:-24+48*step/240};
      camera=frameTravelCards(actor,stations,view,camera,{...camera,scale:immersiveTileScale(view.width),yaw:0},16);
      for(const point of [...stations.flatMap(travelFaceCorners),{...actor,z:0},{...actor,z:3.6}]){
        const q=projectTravelFramePoint(point,camera,view);
        expect(q.depth).toBeGreaterThan(100);
        expect(q.x).toBeGreaterThanOrEqual(35.99);expect(q.x).toBeLessThanOrEqual(view.width-35.99);
        expect(q.y).toBeGreaterThanOrEqual(95.99);expect(q.y).toBeLessThanOrEqual(view.height-111.99);
      }
    }
  });
  it('steadies orientation during interaction and does not alter fixed stations',()=>{
    const copy=JSON.stringify(stations),view={width:1221,height:650},actor={x:0,y:18};
    const current={x:0,y:-360,scale:20,yaw:15,pitch:68,aimY:100};
    const next=frameTravelCards(actor,stations,view,current,{...current,scale:33,yaw:0},16,true);
    expect(next.yaw).toBe(15);expect(next.pitch).toBe(68);expect(JSON.stringify(stations)).toBe(copy);
  });
  it('reduced motion settles deterministically without decorative drift',()=>{
    const view={width:1221,height:650},actor={x:0,y:24},current={x:0,y:0,scale:33,yaw:0,pitch:82};
    const a=frameTravelCards(actor,stations,view,current,current,16,false,true);
    const b=frameTravelCards(actor,stations,view,a,current,16,false,true);
    expect(b).toEqual(a);
  });
  it('eases back after the final card without breaking actor translation',()=>{
    const actor={x:15,y:24},view={width:1221,height:650};
    const current={x:-300,y:-480,scale:20,yaw:20,pitch:68,aimY:100};
    const next=frameTravelCards(actor,[],view,current,{...current,scale:33,yaw:0},16);
    expect(next.scale).toBeGreaterThan(20);expect(next.scale).toBeLessThan(21);
    expect(next.x+actor.x*next.scale).toBeCloseTo(0,8);
    expect(next.y+actor.y*next.scale).toBeCloseTo(0,8);
    expect(next.yaw).toBeGreaterThan(19);expect(next.pitch).toBeLessThan(69);
  });
  it('keeps elevated faces framed through a route turn and returns toward shoulder as they clear',()=>{
    const view={width:1221,height:650},actor={x:0,y:24};
    let camera:CameraState={x:0,y:0,scale:33,yaw:0,pitch:82};
    for(let frame=0;frame<160;frame++){
      camera=frameTravelCards(actor,stations,view,camera,{...camera,scale:33,yaw:Math.min(90,frame)},16);
      expect(Math.abs(Math.cos((camera.yaw??0)*Math.PI/180))).toBeGreaterThanOrEqual(.3);
      for(const point of stations.flatMap(travelFaceCorners)){
        const q=projectTravelFramePoint(point,camera,view);
        expect(q.x).toBeGreaterThanOrEqual(35.99);expect(q.x).toBeLessThanOrEqual(view.width-35.99);
        expect(q.y).toBeGreaterThanOrEqual(95.99);expect(q.y).toBeLessThanOrEqual(view.height-111.99);
      }
    }
    const nearby=[{x:4,y:20,heading:0,elevation:0}];
    for(let frame=0;frame<600;frame++)camera=frameTravelCards(actor,nearby,view,camera,{...camera,scale:33,yaw:0},16);
    expect(camera.scale).toBeCloseTo(33,1);expect(camera.yaw).toBeCloseTo(0,1);
    expect(camera.pitch).toBeCloseTo(82,1);expect(camera.aimY).toBeCloseTo(view.height*.28,0);
  });
});
