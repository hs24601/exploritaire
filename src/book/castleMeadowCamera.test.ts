import * as THREE from 'three';
import {describe,expect,it} from 'vitest';
import {createMeadowCameraClearance,createMeadowCameraMotion} from './castleMeadowCamera';

function box(size: [number,number,number],position: [number,number,number]) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size));
  mesh.position.set(...position);
  mesh.updateMatrixWorld();
  return mesh;
}

describe('meadow camera clearance',()=>{
  const head = new THREE.Vector3(0,1.3,0);

  it('never interpolates a new follow rig from the world origin',()=>{
    const camera=createMeadowCameraMotion(createMeadowCameraClearance([])),desired=new THREE.Vector3(4,3,82),focus=new THREE.Vector3(0,.55,75);
    const first=camera.update(new THREE.Vector3(0,1.3,75),desired,focus,.26,1/60);
    expect(first.toArray()).toEqual(desired.toArray());
  });

  it('clears an old collision-recovery hold when an external camera hands back control',()=>{
    const wall=box([10,16,.5],[0,5,-2]),camera=createMeadowCameraMotion(createMeadowCameraClearance([wall]));
    const focus=new THREE.Vector3(0,.55,0),desired=new THREE.Vector3(0,5,-6);
    camera.update(head,desired,focus,.25,0);
    wall.position.x=20;wall.updateMatrixWorld();
    camera.reset(desired);
    for(let i=0;i<60;i++)expect(camera.update(head,desired,focus,.25,1/60).toArray()).toEqual(desired.toArray());
  });

  it('raises and lowers at the requested height beside a wall',()=>{
    const resolve = createMeadowCameraClearance([box([10,16,.5],[0,5,-2])]);
    for (const y of [3,5,7]) {
      const position = resolve(head,new THREE.Vector3(0,y,-6),.25);
      expect(position.y).toBe(y);
      expect(position.z).toBeCloseTo(-1.5);
    }
  });

  it('retracts below a low ceiling and recovers when the path clears',()=>{
    const resolve = createMeadowCameraClearance([box([10,.3,8],[0,2.8,-2])]);
    expect(resolve(head,new THREE.Vector3(0,5,-4),.25).y).toBeLessThan(2.55);
    const low = new THREE.Vector3(0,2,-4);
    expect(resolve(head,low.clone(),.25).toArray()).toEqual(low.toArray());
  });

  it('keeps clearance at the edge and end of the view boom',()=>{
    const edge = createMeadowCameraClearance([box([.1,5,.4],[.24,1.3,-3])]);
    expect(edge(head,new THREE.Vector3(0,1.3,-4),.25).z).toBeGreaterThan(-2.8);
    const end = createMeadowCameraClearance([box([5,5,.2],[0,1.3,-4.27])]);
    expect(end(head,new THREE.Vector3(0,1.3,-4),.25).z).toBeGreaterThan(-4);
  });

  it('checks Hero visibility below the shoulder pivot',()=>{
    const resolve = createMeadowCameraClearance([box([4,.6,.25],[0,.65,-1])]);
    const desired = new THREE.Vector3(0,1.3,-4);
    expect(resolve(head,desired.clone(),.25).toArray()).toEqual(desired.toArray());
    expect(resolve(head,desired.clone(),.25,new THREE.Vector3(0,.55,0)).z).toBeGreaterThan(-.9);
  });

  it('holds a steady obstructed pose and waits for clearance before easing back',()=>{
    const wall = box([10,16,.5],[0,5,-2]);
    const camera = createMeadowCameraMotion(createMeadowCameraClearance([wall]));
    const focus = new THREE.Vector3(0,.55,0), desired = new THREE.Vector3(0,5,-6);
    const constrained = camera.update(head,desired,focus,.25,0).clone();
    for (let i=0;i<60;i++) {
      expect(camera.update(head,desired,focus,.25,1/60).toArray()).toEqual(constrained.toArray());
    }
    wall.position.x=20; wall.updateMatrixWorld();
    expect(camera.update(head,desired,focus,.25,.12).toArray()).toEqual(constrained.toArray());
    const recovering = camera.update(head,desired,focus,.25,.08);
    expect(recovering.z).toBeLessThan(constrained.z);
    expect(recovering.z).toBeGreaterThan(desired.z);
  });
});
