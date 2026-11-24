import * as THREE from 'three';
import {expect,it} from 'vitest';
import {installHeightfieldRaycast} from './heightfieldRaycast';

it('matches Three ground hits, normals and UVs for vertical, grazing, transformed and clipped rays',()=>{
 const geometry=new THREE.PlaneGeometry(32,32,16,16).rotateX(-Math.PI/2),positions=geometry.attributes.position;
 for(let i=0;i<positions.count;i++)positions.setY(i,Math.sin(positions.getX(i)*.25)*2+Math.cos(positions.getZ(i)*.3));
 const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial()),stock=mesh.raycast;
 const random=(()=>{let seed=37;return()=>((seed=Math.imul(seed,1664525)+1013904223)>>>0)/4294967296;})();
 for(const side of [THREE.FrontSide,THREE.BackSide,THREE.DoubleSide]){
  mesh.material.side=side;
  mesh.position.set(3,-2,4);mesh.rotation.set(.1,.35,-.08);mesh.scale.set(1.2,.8,1.6);mesh.updateMatrixWorld(true);
  installHeightfieldRaycast(mesh,16);
  for(let i=0;i<240;i++){
   const origin=new THREE.Vector3((random()-.5)*60,random()*15-5,(random()-.5)*60);
   const target=new THREE.Vector3((random()-.5)*30,random()*4-2,(random()-.5)*30);
   if(i%3===0){origin.copy(target);origin.y+=10;}
   const raycaster=new THREE.Raycaster(origin,target.sub(origin).normalize(),i%4===0?7:0,i%5===0?15:Infinity);
   const expected:THREE.Intersection[]=[],actual:THREE.Intersection[]=[];
   stock.call(mesh,raycaster,expected);mesh.raycast(raycaster,actual);expected.sort((a,b)=>a.distance-b.distance);
   expect(actual.length>0,`ray ${i}, side ${side}`).toBe(expected.length>0);
   if(actual.length){expect(actual[0].distance).toBeCloseTo(expected[0].distance,5);expect(actual[0].point.distanceTo(expected[0].point)).toBeLessThan(1e-5);expect(actual[0].uv!.distanceTo(expected[0].uv!)).toBeLessThan(1e-5);expect(actual[0].face!.normal.distanceTo(expected[0].face!.normal)).toBeLessThan(1e-5);}
  }
 }
});

it('handles cell edges, a vertical ray, and a ray parallel to flat terrain',()=>{
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(8,8,4,4).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial());mesh.updateMatrixWorld();
 installHeightfieldRaycast(mesh,4);
 for(const x of [-4,-2,0,2,4])for(const z of [-4,-2,0,2,4]){
  const hits=new THREE.Raycaster(new THREE.Vector3(x,3,z),new THREE.Vector3(0,-1,0)).intersectObject(mesh);
  expect(hits[0]?.point.y).toBeCloseTo(0,6);
 }
 expect(new THREE.Raycaster(new THREE.Vector3(0,3,0),new THREE.Vector3(1,0,0)).intersectObject(mesh)).toHaveLength(0);
});
