import {describe, expect, it, vi} from 'vitest';
import * as THREE from 'three';
import {CastleCameraGestures} from './castleCameraGestures';
import {createCombatCameraControls} from '../proto/combatCameraControls';

function fixture(free = false) {
  const actions = {free:()=>free, orbit:vi.fn(), pan:vi.fn(), zoom:vi.fn(), tap:vi.fn(),interruptTap:vi.fn()};
  return {actions, gesture:new CastleCameraGestures(actions)};
}
describe('castle camera input', () => {
  it('preserves a tap pair across the normal lost-capture cleanup after pointerup',()=>{
    const {gesture:g,actions:a}=fixture();g.down(1,{x:10,y:10},false,false);g.up(1,{x:10,y:10});g.up(1,{x:10,y:10},true);
    expect(a.tap).toHaveBeenCalledTimes(1);expect(a.interruptTap).not.toHaveBeenCalled();
    g.down(1,{x:10,y:10},false,false);g.up(1,{x:10,y:10});g.up(1,{x:10,y:10},true);expect(a.tap).toHaveBeenCalledTimes(2);expect(a.interruptTap).not.toHaveBeenCalled();
  });
  it('breaks pending double taps on drag, pinch, cancellation and clear',()=>{
    const {gesture:g,actions:a}=fixture();g.down(1,{x:10,y:10},false,false);g.move(1,{x:30,y:10});expect(a.interruptTap).toHaveBeenCalledTimes(1);g.up(1,{x:30,y:10});
    g.down(1,{x:10,y:10},true,false);g.down(2,{x:30,y:10},true,false);expect(a.interruptTap).toHaveBeenCalledTimes(2);g.up(2,{x:30,y:10},true);expect(a.interruptTap).toHaveBeenCalledTimes(3);g.clear();expect(a.interruptTap).toHaveBeenCalledTimes(4);
  });
  it('keeps travel taps and follow-mode drags distinct', () => {
    const {gesture:g,actions:a} = fixture();
    g.down(1,{x:10,y:10},true,false); g.move(1,{x:12,y:10}); g.up(1,{x:12,y:10});
    expect(a.tap).toHaveBeenCalledTimes(1);
    g.down(2,{x:10,y:10},true,false); g.move(2,{x:30,y:20}); g.up(2,{x:30,y:20});
    expect(a.orbit).toHaveBeenCalledWith(20,10); expect(a.tap).toHaveBeenCalledTimes(1);
  });
  it('pinches proportionally without orbiting or travelling when fingers lift', () => {
    const {gesture:g,actions:a} = fixture();
    g.down(1,{x:0,y:0},true,false); g.down(2,{x:100,y:0},true,false);
    g.move(2,{x:200,y:0}); g.up(2,{x:200,y:0}); g.up(1,{x:0,y:0});
    expect(a.zoom).toHaveBeenCalledWith(Math.log(.5));
    expect(a.orbit).not.toHaveBeenCalled(); expect(a.pan).not.toHaveBeenCalled(); expect(a.tap).not.toHaveBeenCalled();
  });
  it('pans with one or two fingers in freecam', () => {
    const {gesture:g,actions:a} = fixture(true);
    g.down(1,{x:0,y:0},true,false); g.move(1,{x:10,y:20});
    expect(a.pan).toHaveBeenLastCalledWith(10,20);
    g.down(2,{x:100,y:0},true,false); g.move(2,{x:120,y:10});
    expect(a.pan).toHaveBeenLastCalledWith(10,5); expect(a.zoom).toHaveBeenCalled();
  });
  it('allows Control taps to teleport in freecam without turning drags or pinches into teleports', () => {
    const {gesture:g,actions:a} = fixture(true);
    const point = {x:15,y:20};
    g.down(1,point,false,false); g.up(1,point);
    g.down(2,point,true,false); g.up(2,point,false,true);
    g.down(3,point,false,false); g.move(3,{x:60,y:20}); g.up(3,{x:60,y:20},false,true);
    g.down(4,point,true,false); g.down(5,{x:80,y:20},true,false);
    g.up(5,{x:80,y:20},false,true); g.up(4,point,false,true);
    expect(a.tap).toHaveBeenCalledTimes(1);
    expect(a.tap).toHaveBeenCalledWith(point,true);
  });
  it('three-finger gestures rotate and rebase on finger-count changes', () => {
    const {gesture:g,actions:a} = fixture(true);
    for (let i=1;i<=3;i++) g.down(i,{x:i*40,y:50},true,false);
    expect(a.orbit).not.toHaveBeenCalled();
    g.move(3,{x:130,y:80}); expect(a.orbit).toHaveBeenCalledTimes(1);
    g.up(3,{x:130,y:80}); expect(a.zoom).not.toHaveBeenCalled();
  });
  it('cancels without issuing a tap and ignores released pointers', () => {
    const {gesture:g,actions:a} = fixture();
    g.down(1,{x:0,y:0},true,false); g.up(1,{x:0,y:0},true); g.move(1,{x:30,y:30});
    g.down(2,{x:0,y:0},true,false); g.clear(); g.up(2,{x:0,y:0});
    g.down(3,{x:0,y:0},false,false,true); g.up(3,{x:0,y:0});
    expect(a.tap).not.toHaveBeenCalled(); expect(a.orbit).not.toHaveBeenCalled();
  });
  it('preserves combat defaults while allowing the larger grounds zoom range', () => {
    for (const max of [60,165]) {
      const camera = new THREE.PerspectiveCamera();
      const c = max===60 ? createCombatCameraControls(camera) : createCombatCameraControls(camera,'party',{minDistance:2.6,maxDistance:max});
      c.update(4,0,true); c.select('freecam',0); c.dolly(100);
      expect(c.snapshot().distance).toBeCloseTo(max);
      c.dolly(-100); expect(c.snapshot().distance).toBeCloseTo(max===60?1:2.6);
    }
  });
  it('routes a free-camera pinch into the actual combat dolly controller', () => {
    const camera = new THREE.PerspectiveCamera();
    const controls = createCombatCameraControls(camera,'party',{minDistance:2.6,maxDistance:165});
    controls.update(4,0,true); controls.select('freecam',0);
    const before = controls.snapshot().distance;
    const actions = {free:()=>true, orbit:vi.fn(), pan:vi.fn(), zoom:(scale:number)=>controls.dolly(scale), tap:vi.fn()};
    const g = new CastleCameraGestures(actions);
    g.down(1,{x:500,y:350},true,false); g.down(2,{x:700,y:350},true,false);
    g.move(1,{x:460,y:370}); g.move(2,{x:780,y:370});
    g.up(1,{x:460,y:370}); g.up(2,{x:780,y:370});
    expect(controls.snapshot().distance).toBeCloseTo(before * 200 / 320);
    expect(actions.tap).not.toHaveBeenCalled();
  });
});
