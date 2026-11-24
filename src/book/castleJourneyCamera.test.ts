import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createJourneyCamera,type JourneyLandmark} from './castleJourneyCamera';

const landmark:JourneyLandmark={id:'distant-ruin',point:new THREE.Vector3(0,7,-55),radius:6,halfHeight:6,priority:2};
function fixture(reduced=false,visible=()=>true){
  const director=createJourneyCamera(reduced,visible,'cinematic'),camera=new THREE.PerspectiveCamera(60,16/9,.08,9000);
  camera.position.set(2,4,10);camera.lookAt(0,.8,0);
  const input={hero:new THREE.Vector3(),velocity:new THREE.Vector3(0,0,-5),grounded:true,destination:{x:0,y:0,z:-65},route:[{x:0,y:0,z:-65}],aspect:16/9};
  director.start(input.hero,input.destination,camera,[landmark]);
  return {director,camera,input};
}
describe('cinematic point-to-move camera',()=>{
  it('defaults to an intimate follow without pulling back for a long route or a landmark',()=>{
    const director=createJourneyCamera(false,()=>true),camera=new THREE.PerspectiveCamera(60,16/9,.08,9000);
    camera.position.set(2,3,7);camera.lookAt(0,.65,0);
    const hero=new THREE.Vector3(),input={hero,velocity:new THREE.Vector3(0,0,-7.2),grounded:true,destination:{x:0,z:-100},route:[],aspect:16/9};
    director.start(hero,input.destination,camera,[landmark]);const range=director.diagnostics.range;
    let pose;
    for(let i=0;i<600;i++){hero.z-=7.2/60;pose=director.update(1/60,input)!;}
    expect(director.diagnostics.style).toBe('close');expect(director.diagnostics.landmark).toBeUndefined();expect(pose!.distance).toBe(range);expect(pose!.fov).toBe(60);
    expect(pose!.position.distanceTo(hero)).toBeLessThan(8.5);expect(pose!.target.distanceTo(hero.clone().add(new THREE.Vector3(0,.65,0)))).toBeLessThan(.8);
  });
  it('groups Hero and a visible distant landmark in a wider journey shot',()=>{
    const {director,camera,input}=fixture();let pose;
    for(let i=0;i<300;i++)pose=director.update(1/60,input)!;
    expect(director.diagnostics.landmark).toBe('distant-ruin');expect(pose!.fov).toBeGreaterThan(65);
    camera.fov=pose!.fov;camera.position.copy(pose!.position);camera.lookAt(pose!.target);camera.updateProjectionMatrix();camera.updateMatrixWorld();
    for(const point of [new THREE.Vector3(0,.65,0),landmark.point.clone()]){
      point.project(camera);expect(Math.abs(point.x)).toBeLessThan(.9);expect(Math.abs(point.y)).toBeLessThan(.9);
    }
  });
  it('yields to manual control until a new accepted destination starts a journey',()=>{
    const {director,camera,input}=fixture();director.update(.1,input);director.release();
    expect(director.update(1,input)).toBeUndefined();expect(director.diagnostics.manual).toBe(true);
    director.start(input.hero,{x:20,y:0,z:-20},camera,[]);
    expect(director.update(.1,input)).toBeDefined();expect(director.diagnostics.manual).toBe(false);
  });
  it('preserves a fixed view and lens under reduced motion while following movement',()=>{
    const {director,camera,input}=fixture(true);const offset=camera.position.clone();
    input.hero.set(5,2,-10);const pose=director.update(1,input)!;
    expect(pose.position.clone().sub(input.hero).distanceTo(offset)).toBeLessThan(1e-8);
    expect(pose.fov).toBe(60);expect(director.diagnostics.landmark).toBeUndefined();
  });
  it('does not frame an occluded landmark',()=>{
    const director=createJourneyCamera(false,(_from,_to,radius=0)=>radius===0,'cinematic'),camera=new THREE.PerspectiveCamera(60,16/9,.08,9000);
    camera.position.set(0,4,10);camera.lookAt(0,.65,0);
    const input={hero:new THREE.Vector3(),velocity:new THREE.Vector3(0,0,-5),grounded:true,destination:{x:0,y:0,z:-65},route:[],aspect:16/9};
    director.start(input.hero,input.destination,camera,[landmark]);
    for(let i=0;i<240;i++)director.update(1/60,input);
    expect(director.diagnostics.landmark).toBeUndefined();
  });
  it('limits orbital motion across a sharp route reversal and settles at arrival',()=>{
    const {director,input}=fixture();let previous=director.update(1/60,input)!.yaw;
    input.route=[{x:0,y:0,z:65}];
    for(let i=0;i<120;i++){
      const pose=director.update(1/60,input)!;
      expect(Math.abs(pose.yaw-previous)).toBeLessThanOrEqual(.42/60+1e-9);previous=pose.yaw;
    }
    const ended={...input,destination:undefined,route:[],velocity:new THREE.Vector3()};
    for(let i=0;i<1500;i++)director.update(1/60,ended);
    const before=director.diagnostics.position;
    for(let i=0;i<120;i++)director.update(1/60,ended);
    expect(director.diagnostics.phase).toBe('settled');
    expect(new THREE.Vector3(...before).distanceTo(new THREE.Vector3(...director.diagnostics.position))).toBeLessThan(.001);
  });
});
