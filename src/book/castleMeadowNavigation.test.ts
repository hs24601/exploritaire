import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {createMeadowTerrain,createMeadowNavigation,createMeadowSurface,type MeadowPoint} from './castleMeadowNavigation';
import {CastlePlatformMotion,type PlatformSurface} from './castlePlatformMotion';
import {resolveMove} from './castleLayout';
import {openMeadowClearing} from './meadowClearing';
// @ts-expect-error Vitest provides Node builtins; the app's TS configuration is browser-only.
import {readFileSync} from 'node:fs';

const bounds={minX:-7,maxX:7,minZ:-7,maxZ:7,minY:-.1};
function box(w:number,h:number,d:number,x:number,y:number,z:number){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d));mesh.position.set(x,y,z);mesh.updateMatrixWorld();return mesh;
}
function fixture(obstacles:THREE.Mesh[]=[]){
  const terrain=createMeadowTerrain([box(16,.2,16,0,-.1,0),...obstacles],bounds);
  const nav=createMeadowNavigation(terrain);
  const surface=createMeadowSurface(terrain);
  return {terrain,nav,surface};
}
function travel(f:ReturnType<typeof fixture>,from:MeadowPoint,to:MeadowPoint){
  const hero=new CastlePlatformMotion(from.x,from.z,Math.PI,f.surface);hero.y=from.y;
  expect(f.nav.setDestination(hero,to)).toBe(true);
  const plan=f.nav.diagnostics.route;
  for(let i=0;i<2400&&f.nav.destination;i++){
    const intent=f.nav.steer(hero,1/120);
    hero.update(1/120,{x:intent?.x??0,z:intent?.z??0,run:!!intent?.run,crouch:false,jumpPressed:!!intent?.jump,jumpHeld:!!intent,divePressed:false,sustainSprint:false,jumpTier:intent?.jumpTier,jumpLanding:intent?.jumpLanding});
  }
  expect(f.nav.diagnostics.result,JSON.stringify({position:{x:hero.x,y:hero.y,z:hero.z},plan,remaining:f.nav.diagnostics.route})).toBe('arrived');return {hero,plan};
}
describe('elevated meadow navigation',()=>{
  it('approaches a clicked wall at ground level instead of climbing its top',()=>{
    const f=fixture([box(3,2,3,0,1,0)]),hero=new CastlePlatformMotion(-4,0,Math.PI,f.surface);
    expect(f.nav.setAdjacentDestination(hero,{x:-1.5,z:0})).toBe(true);
    expect(f.nav.destination!.y).toBeCloseTo(0);expect(f.nav.destination!.x).toBeLessThan(-1.94);expect(f.nav.cameraRoute.some(point=>point.jumpTier)).toBe(false);
    for(let i=0;i<1200&&f.nav.destination;i++){const move=f.nav.steer(hero,1/120);hero.update(1/120,{x:move?.x??0,z:move?.z??0,run:!!move?.run,crouch:false,jumpPressed:!!move?.jump,jumpHeld:false,divePressed:false});}
    expect(f.nav.diagnostics.result).toBe('arrived');expect(hero.y).toBeCloseTo(0);expect(hero.x).toBeLessThan(-1.94);
  });
  it('finds the closest reachable approach when nearer candidates are across an impassable wall',()=>{
    const f=fixture([box(.4,20,16,0,10,0)]);
    expect(f.nav.setAdjacentDestination({x:-4,y:0,z:0},{x:1,z:0,radius:.1})).toBe(true);
    expect(f.nav.destination!.x).toBeLessThan(-.64);expect(f.nav.destination!.x).toBeGreaterThan(-1);expect(f.nav.destination!.y).toBeCloseTo(0);
  });
  it('keeps wall approaches on the current floor beneath an overlapping roof',()=>{
    const f=fixture([box(4,.4,4,0,3,0),box(.6,1,.6,0,.5,0)]);
    expect(f.nav.setAdjacentDestination({x:0,y:0,z:-4},{x:0,z:0})).toBe(true);expect(f.nav.destination!.y).toBeCloseTo(0);
  });
  it('keeps the floor below an overhang separate from its roof',()=>{
    const f=fixture([box(4,.4,4,0,3,0)]);
    expect(f.terrain.height(0,0,.1)).toBeCloseTo(0);
    expect(f.terrain.height(0,0,3.2)).toBeCloseTo(3.2);
    const levels=f.terrain.layers(0,0);expect(levels).toHaveLength(2);
    expect(levels[0]).toBeCloseTo(3.2);expect(levels[1]).toBeCloseTo(0);
  });
  it('walks around masonry instead of rejecting a blocked straight line',()=>{
    const f=fixture([box(2,12,4,0,6,0)]);
    const {hero,plan}=travel(f,{x:-4,y:0,z:0},{x:4,y:0,z:0});
    expect(plan.length).toBeGreaterThan(1);expect(hero.x).toBeCloseTo(4,0);
  });
  it('infers a safe top from a wall-face click and physically jumps onto it',()=>{
    const f=fixture([box(3,2,3,0,1,0)]);
    const {hero,plan}=travel(f,{x:-4,y:0,z:0},{x:-1.5,y:1.5,z:0});
    expect(plan.some(p=>p.jumpTier===2)).toBe(true);
    expect(hero.y).toBeCloseTo(2);expect(hero.x).toBeGreaterThan(-1.1);
  });
  it('rejects an unreachable high wall and jumps blocked by a low ceiling',()=>{
    const high=fixture([box(3,12,3,0,6,0)]);
    expect(high.nav.setDestination({x:-4,y:0,z:0},{x:-1.5,y:10,z:0})).toBe(false);
    const roof=fixture([box(4,.3,4,0,1.5,0),box(2,.8,2,0,.4,0)]);
    expect(roof.terrain.jump({x:-3,y:0,z:0},{x:0,y:.8,z:0})).toBeUndefined();
  });

  it('finds a clearance-checked elevated route on the shipped meadow model',()=>{
    const data=readFileSync(new URL('../../public/assets/runtime/book/castle/sacred_forest_meadow.glb',import.meta.url));
    const jsonLength=data.readUInt32LE(12),gltf=JSON.parse(data.subarray(20,20+jsonLength).toString()),binary=28+jsonLength;
    const read=(id:number)=>{
      const accessor=gltf.accessors[id],view=gltf.bufferViews[accessor.bufferView];
      const components=accessor.type==='VEC3'?3:1,bytes=accessor.componentType===5125||accessor.componentType===5126?4:2;
      const result:number[]=[];
      for(let i=0;i<accessor.count;i++)for(let c=0;c<components;c++){
        const offset=binary+(view.byteOffset??0)+(accessor.byteOffset??0)+i*(view.byteStride??bytes*components)+c*bytes;
        result.push(accessor.componentType===5126?data.readFloatLE(offset):bytes===4?data.readUInt32LE(offset):data.readUInt16LE(offset));
      }
      return result;
    };
    const wanted=['obj1_mat0_0','obj8_mat7_0','obj9_mat8_0','obj10_mat9_0','obj11_mat10_0','obj12_mat11_0','obj14_mat13_0','obj15_mat14_0'];
    const meshes:THREE.Mesh[]=[];
    const visit=(id:number,parent:THREE.Object3D)=>{
      const node=gltf.nodes[id],object=new THREE.Group();parent.add(object);
      if(node.matrix)new THREE.Matrix4().fromArray(node.matrix).decompose(object.position,object.quaternion,object.scale);
      if(node.mesh!==undefined&&wanted.includes(node.name))for(const primitive of gltf.meshes[node.mesh].primitives){
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(read(primitive.attributes.POSITION),3));
        geometry.setIndex(read(primitive.indices));const mesh=new THREE.Mesh(geometry);mesh.name=node.name;object.add(mesh);meshes.push(mesh);
      }
      for(const child of node.children??[])visit(child,object);
    };
    const model=new THREE.Group();model.scale.set(.01725,.0345,.01725);model.position.set(-.45*(1-1.725),0,20.25*(1-1.725));
    for(const id of gltf.scenes[gltf.scene??0].nodes)visit(id,model);
    model.updateMatrixWorld(true);
    const ruinBox=new THREE.Box3().makeEmpty();for(const m of meshes)if(['obj1_mat0_0','obj8_mat7_0','obj10_mat9_0'].includes(m.name))ruinBox.union(new THREE.Box3().setFromObject(m));
    const terrain=createMeadowTerrain(meshes,{minX:Math.min(-10.55,ruinBox.min.x-.7),maxX:Math.max(9.13,ruinBox.max.x+.7),minZ:Math.min(-69.71,ruinBox.min.z-.7),maxZ:20.67,minY:-.3105});
    const navigation=createMeadowNavigation(terrain),z=20.25-1.8*1.725;
    const from={x:-.45,y:terrain.height(-.45,z)!,z};expect(terrain.dry(from.x,from.z,.45,from.y)).toBe(true);
    const candidates=terrain.triangles.filter(t=>t.up&&t.minY>from.y+.8&&t.maxY<from.y+6.0).map(t=>{
      const center=new THREE.Box3().setFromPoints([t.shape.a,t.shape.b,t.shape.c]).getCenter(new THREE.Vector3());
      return {x:center.x,y:center.y,z:center.z};
    }).filter(p=>terrain.dry(p.x,p.z,.45,p.y)).sort((a,b)=>Math.hypot(a.x-from.x,a.z-from.z)-Math.hypot(b.x-from.x,b.z-from.z));
    const reached=candidates.some(goal=>navigation.setDestination(from,goal)&&navigation.diagnostics.route.some(p=>p.jumpTier));
    expect(reached).toBe(true);
    expect(navigation.diagnostics.route.every(p=>terrain.dry(p.x,p.z,.45,p.y))).toBe(true);
    const goal=navigation.destination!;
    const {hero}=travel({terrain,nav:navigation,surface:createMeadowSurface(terrain)},from,goal);
    expect(hero.y).toBeCloseTo(goal.y,1);
    const returned=travel({terrain,nav:navigation,surface:createMeadowSurface(terrain)},{x:hero.x,y:hero.y,z:hero.z},from);
    expect(returned.hero.y).toBeCloseTo(from.y,1);
    const clearing=openMeadowClearing(model);meshes.push(clearing.floor);
    expect(clearing.diagnostics.removedTriangles).toBeGreaterThan(100);
    expect(clearing.diagnostics.rampWidth).toBeCloseTo(3.45);
    const open=createMeadowTerrain(meshes,terrain.bounds),nav=createMeadowNavigation(open);
    const start={x:.32625,y:.018,z:12},end={x:.32625,y:.018,z:-18};
    expect(open.canWalk(start,end)).toBe(true);
    const cleared=travel({terrain:open,nav,surface:createMeadowSurface(open)},start,end);
    expect(cleared.plan.some(p=>p.jumpTier)).toBe(false);
    for(const x of [-.7,1.35]){
      const y=open.height(x,-22.2,3);expect(y).toBeGreaterThan(2);
      expect(open.dry(x,-22.2,.3,y)).toBe(true);
    }
    const rampTop={x:.32625,y:5.52,z:-26};
    const rampTrip=travel({terrain:open,nav,surface:createMeadowSurface(open)},end,rampTop);
    expect(rampTrip.plan.some(p=>p.jumpTier)).toBe(false);
  },15000);
});
