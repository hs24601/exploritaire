import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {groundPaintUV,rememberGroundRest,registerGroundUV} from './standGroundPaint';
import {extensionPose} from './pageExtension';
import {forestFilmShots} from './forestFilm';
import {forestWeatherGain,forestFog} from './forestAtmosphere';
import {sampleBookCamera} from './bookCamera';
import source from '../data/bookPages.json';
import {validPageDocument,type BookPageDocument} from './pageDocument';
const pages=source as unknown as BookPageDocument;

describe('painted stands and the expanded forest',()=>{
 it('keeps ground UVs registered to the unfolded page through a moving hinge',()=>{
  const root=new THREE.Group(),hinge=new THREE.Group(),stand=new THREE.Mesh(new THREE.BoxGeometry(2,.01,2));root.position.set(3,0,-1);root.add(hinge);hinge.add(stand);stand.position.x=1;stand.userData.paperStand=true;
  rememberGroundRest(root);registerGroundUV(stand);const before=Array.from(stand.geometry.getAttribute('uv').array);
  hinge.rotation.z=Math.PI*.6;registerGroundUV(stand);expect(Array.from(stand.geometry.getAttribute('uv').array)).toEqual(before);
  root.position.x+=2;registerGroundUV(stand);expect(stand.geometry.getAttribute('uv').getX(0)-before[0]).toBeCloseTo(.1);
  expect(groundPaintUV(0,0)).toEqual([.5,.5]);
 });
 it('preserves nested stand frames while registering a whole extension',()=>{
  const outer=new THREE.Group(),inner=new THREE.Group(),hinge=new THREE.Group(),stand=new THREE.Mesh(new THREE.BoxGeometry(1,.01,1));inner.position.x=3;outer.add(inner);inner.add(hinge);hinge.add(stand);stand.userData.paperStand=true;
  rememberGroundRest(inner);const rest=stand.userData.groundPaintRest;rememberGroundRest(outer);expect(stand.userData.groundPaintRest).toEqual(rest);
 });
 it('stows trees before closing the leaves and extends both authored pages',()=>{
  expect(validPageDocument(source)).toBe(true);
  const extensions=pages.pages.find(p=>p.page===2)!.controls.filter(c=>c.popup?.mechanism==='extension');
  expect(extensions.map(c=>c.popup!.extensionSide).sort()).toEqual(['left','right']);
  expect(extensionPose(0)).toEqual({leaf:0,trees:0});expect(extensionPose(1)).toEqual({leaf:1,trees:1});
  expect(extensionPose(.4).trees).toBe(0);expect(extensionPose(.4).leaf).toBeGreaterThan(0);
  for(let n=0;n<=1;n+=.01){const p=extensionPose(n);expect(p.leaf).toBeGreaterThanOrEqual(p.trees);}
 });
 it('swoops past tree trunks along a continuous camera path',()=>{
  const shots=forestFilmShots(),initial=shots[0].shot,pines=source.pages.find(p=>p.page===2)!.controls.filter(c=>c.id.startsWith('forest-pine-'));
  for(let t=8300;t<18200;t+=35){const {shot}=sampleBookCamera(shots,initial,t);const [x,y,z]=shot.position;expect(y).toBeGreaterThan(.75);expect(new THREE.Vector3(...shot.position).distanceTo(new THREE.Vector3(...shot.target))).toBeGreaterThan(.5);for(const pine of pines)if(y<pine.height+.1)expect(Math.hypot(x-pine.x,z-pine.z),`trunk ${pine.id} at ${t}`).toBeGreaterThan(.25);}
  for(const time of [11200,14200,17000]){const p=(t:number)=>new THREE.Vector3(...sampleBookCamera(shots,initial,t).shot.position),left=p(time).sub(p(time-1)),right=p(time+1).sub(p(time));expect(left.distanceTo(right)).toBeLessThan(.00003);}
 });
 it('extinguishes all atmosphere at the closed endpoints',()=>{
  expect(forestWeatherGain(0,0)).toBe(0);expect(forestWeatherGain(18,0)).toBe(0);expect(forestWeatherGain(10,1)).toBe(1);
  const fog=source.pages.find(p=>p.page===2)!.atmosphere;
  expect(forestFog(fog as Parameters<typeof forestFog>[0],9,0).enabled).toBe(false);
 });
});
