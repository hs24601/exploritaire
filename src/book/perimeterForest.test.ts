import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import source from '../data/bookPages.json';
import {validPageDocument} from './pageDocument';
import {extensionPose,packExtensionTree,perimeterExtensionTrees} from './pageExtension';
import sceneSource from '../data/bookScenes.json';
import {validBookDocument} from './sceneDocument';
import {sampleBookStage} from './bookCamera';
import {bookFogAmount} from './bookAtmosphere';

describe('the page 05 forest clearing',()=>{
 it('surrounds a clear center with varied trees and two connected side/rear extension assemblies',()=>{
  const document:unknown=source;if(!validPageDocument(document))throw Error('Invalid pages');
  const controls=document.pages.find(p=>p.page===5)!.controls;
  const extensions=controls.filter(c=>c.popup?.forestRing);
  expect(extensions.map(c=>c.popup!.extensionSide).sort()).toEqual(['left','right']);
  const pines=controls.filter(c=>c.art?.includes('pine')&&!c.popup?.forestRing);
  expect(pines).toHaveLength(24);expect(new Set(pines.map(c=>c.height)).size).toBeGreaterThan(4);
  expect(pines.every(c=>Math.abs(c.x)>3||c.z>2.5)).toBe(true);
  expect(controls.filter(c=>/^grove-front-\d+$/.test(c.id))).toHaveLength(11);expect(new Set(controls.filter(c=>/^grove-front-\d+$/.test(c.id)).map(c=>c.z)).size).toBeGreaterThan(1);
  const permanent=pines.filter(c=>!c.id.startsWith('grove-front-tall-')).length+perimeterExtensionTrees(-1).length+perimeterExtensionTrees(1).length;
  expect(permanent).toBe(57);expect(permanent).toBeGreaterThanOrEqual(45*1.25);
  expect(document.pages.find(p=>p.page===5)!.atmosphere).toMatchObject({enabled:true,mode:'consistent',color:'#0b1b20'});
  const fog=document.pages.find(p=>p.page===5)!.atmosphere;
  expect(bookFogAmount(5,2,.15,fog)).toBeGreaterThan(.5);
  expect(bookFogAmount(22,14,.15,fog)).toBeGreaterThan(bookFogAmount(5,2,.15,fog));
 });
 it('keeps the full foreground tree row standing after the tour',()=>{
  const document:unknown=sceneSource;if(!validBookDocument(document))throw Error('Invalid scenes');
  const shots=document.chapters.flatMap(c=>c.scenes).find(s=>s.page===5)!.shots;
  for(let i=1;i<=7;i++){const id='grove-front-tall-'+i;expect(sampleBookStage(shots,{},31500)[id]).toBe(1);expect(sampleBookStage(shots,{},33000)[id]).toBe(1);expect(sampleBookStage(shots,{},36000)[id]).toBe(1);}
  expect(sampleBookStage(shots,{},36000)['grove-extension-left']).toBe(1);
  expect(sampleBookStage(shots,{},36000)['grove-front-1']).toBe(1);
 });
 it('fits oversized folded cut-outs inside their own leaf with an inset margin, including rotated cuts',()=>{
  for(const yaw of [0,.3,1.2,2.4]){
   const bounds=new THREE.Box3(new THREE.Vector3(-1.4,0,-3.3),new THREE.Vector3(1.6,.02,.8)).applyMatrix4(new THREE.Matrix4().makeRotationY(yaw));
   const area={minX:-2.6,maxX:0,minZ:-2.2,maxZ:0},fit=packExtensionTree(bounds,area,-.3,-.15);
   expect(fit.sx).toBe(fit.sz);expect(bounds.min.x*fit.sx+fit.x).toBeGreaterThanOrEqual(area.minX+.0799);expect(bounds.max.x*fit.sx+fit.x).toBeLessThanOrEqual(area.maxX-.0799);expect(bounds.min.z*fit.sz+fit.z).toBeGreaterThanOrEqual(area.minZ+.0799);expect(bounds.max.z*fit.sz+fit.z).toBeLessThanOrEqual(area.maxZ-.0799);
  }
  expect(extensionPose(.4).trees).toBe(0);expect(extensionPose(.4).leaf).toBeGreaterThan(0);
 });
});
