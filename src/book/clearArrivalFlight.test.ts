import {describe,it,expect,vi} from 'vitest';
import * as THREE from 'three';
import {createClearArrivalFlight} from './clearArrivalFlight';
import {directGroundsArrival,groundedOrbitPose} from './castleArrival';
import {WORLD_1111_LAYOUT,WORLD_TREE_PORTAL_ARRIVAL} from './world1111Layout';
import {shoulderPose,type FlightKey} from './castleLayout';

// Paint is immaterial to solid geometry. Keep the actual seeded tree, forest,
// terrain and rock construction, without requiring a raster/browser backend.
vi.mock('./castleWatercolor',async()=>{
  const actual=await vi.importActual<typeof import('./castleWatercolor')>('./castleWatercolor');
  return {...actual,paintWcWood:()=>new THREE.Texture(),paintWcBank:()=>new THREE.Texture(),paintWcCliff:()=>new THREE.Texture()};
});
vi.mock('./worldTreeGroundCover',()=>({createWorldTreeGroundCover:()=>({grassCards:0}),worldTreeSoilPaint:()=>new THREE.Texture()}));
vi.mock('./waterfallParticles',()=>({createWaterfallFlow:()=>({texture:new THREE.Texture(),update:()=>{},dispose:()=>{}})}));
import {createWorldTreeScene,treeGround,treeWalkable} from './worldTreeScene';

const keys=(start:THREE.Vector3,end:THREE.Vector3):readonly FlightKey[]=>[
  {t:0,position:start.toArray(),target:end.toArray(),fov:50},
  {t:8,position:end.toArray(),target:end.clone().add(new THREE.Vector3(0,0,-1)).toArray(),fov:60},
];
describe('cleared initial fly-in',()=>{
  it.each([1432/734,412/915])('flies to the captured tree shot over walkable ground at aspect %s',(aspect)=>{
    const {hero,camera,approachLift}=WORLD_TREE_PORTAL_ARRIVAL;
    expect(treeWalkable(hero.x,hero.z)).toBe(true);
    expect(treeGround(hero.x,hero.z)).toBe(0);
    const art=[{aspect:992/1586,foot:.006},{aspect:1266/1242,foot:.035},{aspect:992/1586,foot:.006}].map(a=>({...a,texture:new THREE.Texture()}));
    const grove=createWorldTreeScene(new THREE.Scene(),new THREE.MeshBasicMaterial(),m=>m,true,art);
    const path=directGroundsArrival({position:[...camera.position],target:[...camera.target]},undefined,aspect);
    const landing=createClearArrivalFlight(path,treeGround,grove.cameraObstacles,{aspect,approachLift}).sample(path[path.length-1].t);
    expect(landing.done).toBe(true);
    expect(landing.fov).toBe(camera.fov);
    expect(new THREE.Vector3(...landing.position).distanceTo(new THREE.Vector3(...camera.position))).toBeLessThan(1e-8);
    expect(new THREE.Vector3(...landing.target).distanceTo(new THREE.Vector3(...camera.target))).toBeLessThan(1e-8);
  });
  it('detours around a solid instead of passing through or snapping out of it',()=>{
    const box=new THREE.Box3(new THREE.Vector3(-5,0,-5),new THREE.Vector3(5,30,5));
    const start=new THREE.Vector3(-24,8,0),end=new THREE.Vector3(24,4,0),flight=createClearArrivalFlight(keys(start,end),()=>0,[box]);
    let side=0;
    for(let i=0;i<=400;i++){const p=new THREE.Vector3(...flight.sample(i/50).position);expect(box.distanceToPoint(p)).toBeGreaterThan(1);expect(p.y).toBeGreaterThanOrEqual(.45);side=Math.max(side,Math.abs(p.z));}
    expect(side).toBeGreaterThan(6);expect(new THREE.Vector3(...flight.sample(8).position).distanceTo(end)).toBeLessThan(1e-9);
  });
  it('clears intervening terrain even when both authored endpoints are low',()=>{
    const height=(x:number,z:number)=>20*Math.exp(-(x*x+z*z)/80),start=new THREE.Vector3(-30,4,0),end=new THREE.Vector3(30,4,0);
    const flight=createClearArrivalFlight(keys(start,end),height,[]);
    for(let i=0;i<=400;i++){const p=new THREE.Vector3(...flight.sample(i/50).position);expect(p.y-height(p.x,p.z)).toBeGreaterThan(.44);}
  });
  it.each([16/9,1912/914,2.78])('keeps the actual grove and near plane clear at aspect %s, landing on the shared follow pose',(aspect)=>{
    const scene=new THREE.Scene(),art=[{aspect:992/1586,foot:.006},{aspect:1266/1242,foot:.035},{aspect:992/1586,foot:.006}].map(a=>({...a,texture:new THREE.Texture()}));
    const grove=createWorldTreeScene(scene,new THREE.MeshBasicMaterial(),m=>m,true,art);
    const {hero,camera:settings}=aspect===2.78?WORLD_1111_LAYOUT:{hero:{x:0,z:75},camera:{yaw:.45,pitch:.32,distance:7.5}};
    const ground=treeGround(hero.x,hero.z),rest=groundedOrbitPose(shoulderPose(hero.x,hero.z,settings.yaw,settings.pitch,settings.distance,ground),settings.yaw,settings.pitch,treeGround);
    const path=directGroundsArrival(rest,{...hero,y:ground},aspect,{constrainAim:false}),flight=createClearArrivalFlight(path,treeGround,grove.cameraObstacles,{aspect});
    expect(grove.cameraObstacles.length).toBeGreaterThan(900);
    let minimumSolid=Infinity,minimumNearGround=Infinity;
    const camera=new THREE.PerspectiveCamera(50,aspect,.1,3000);
    for(let i=0;i<=400;i++){
      const shot=flight.sample(i/50),p=new THREE.Vector3(...shot.position);
      expect(p.y-treeGround(p.x,p.z)).toBeGreaterThan(.44);
      for(const box of grove.cameraObstacles)minimumSolid=Math.min(minimumSolid,box.distanceToPoint(p));
      camera.position.copy(p);camera.lookAt(new THREE.Vector3(...shot.target));camera.near=THREE.MathUtils.clamp(p.y*.035,.08,2);camera.fov=shot.fov;camera.updateProjectionMatrix();camera.updateMatrixWorld();
      for(const x of [-1,1])for(const y of [-1,1]){const corner=new THREE.Vector3(x,y,-1).unproject(camera);minimumNearGround=Math.min(minimumNearGround,corner.y-treeGround(corner.x,corner.z));}
    }
    expect(minimumSolid).toBeGreaterThanOrEqual(flight.diagnostics.nearPlaneRadius-1e-7);
    expect(minimumNearGround).toBeGreaterThan(.04);
    expect(new THREE.Vector3(...flight.sample(8).position).distanceTo(new THREE.Vector3(...rest.position))).toBeLessThan(1e-8);
    expect(flight.sample(8).fov).toBe(60);
    expect(flight.sample(8).done).toBe(true);
  },20000);
});
