import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {createForestLights,forestFilmShots,forestMote,FOREST_FILM_MS} from './forestFilm';
import {sampleBookCamera,sampleBookOpening,sampleBookStage,validBookStep} from './bookCamera';
import pages from '../data/bookPages.json';
import {validPageDocument} from './pageDocument';

describe('the page 02 forest film',()=>{
 it('is a 20-second sequence with identical, fully closed end compositions',()=>{
  const shots=forestFilmShots(),first=shots[0].shot;
  expect(shots.every(validBookStep)).toBe(true);
  expect(shots.reduce((n,s)=>n+s.durationMs+s.holdMs,0)).toBe(FOREST_FILM_MS);
  expect(sampleBookOpening(shots,1,0)).toBe(0);
  expect(sampleBookOpening(shots,1,FOREST_FILM_MS)).toBe(0);
  expect(sampleBookCamera(shots,first,FOREST_FILM_MS).shot).toEqual(first);
  expect(sampleBookOpening(shots,1,1100)).toBeCloseTo(.5);
  expect(sampleBookOpening(shots,1,10000)).toBe(1);
  expect(sampleBookOpening(shots,1,18900)).toBeCloseTo(.5);
 });
 it('actuates the foreground folds during the close pass and keeps editable page controls',()=>{
  const shots=forestFilmShots();expect(validPageDocument(pages)).toBe(true);
  const controls=pages.pages.find(p=>p.page===2)!.controls;
  expect(controls.filter(c=>c.kind==='popup').length).toBe(22);
  for(const shot of shots)for(const id of Object.keys(shot.stage??{}))expect(controls.some(c=>c.id===id&&c.kind==='popup')).toBe(true);
  expect(sampleBookStage(shots,{},2000)['forest-sapling']).toBeLessThan(.1);
  expect(sampleBookStage(shots,{},9000)['forest-sapling']).toBeGreaterThan(.9);
 });
 it('uses exactly the same paths for the luminous bodies and their real lights, and extinguishes them shut',()=>{
  const lights=createForestLights(new THREE.Scene());
  for(const t of [0,3,8,10.5,14,18]){
   lights.update(t,1,true,720);
   const p=forestMote(0,t),lamp=lights.root.children.find(c=>c instanceof THREE.PointLight) as THREE.PointLight;
   expect(lamp.position.toArray()).toEqual([p.x,p.y,p.z]);
   expect(lamp.intensity).toBeGreaterThan(0);
  }
  lights.update(9,0,true,720);expect(lights.root.visible).toBe(false);
  expect(lights.root.children.filter(c=>c instanceof THREE.PointLight).every(l=>(l as THREE.PointLight).intensity===0)).toBe(true);
  lights.update(9,1,false,720);expect(lights.root.visible).toBe(false);
  lights.dispose();
 });
 it('carries cover values across ordinary shots, holds and cuts',()=>{
  const steps=forestFilmShots().slice(0,3);delete steps[2].bookOpen;
  expect(sampleBookOpening(steps,1,6000)).toBe(1);
  expect(validBookStep({...steps[0],bookOpen:1.1})).toBe(false);
  expect(validBookStep({...steps[0],bookOpen:NaN})).toBe(false);
 });
});
