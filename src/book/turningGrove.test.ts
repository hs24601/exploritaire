import {describe,it,expect} from 'vitest';
import pages from '../data/bookPages.json';
import scenes from '../data/bookScenes.json';
import {validPageDocument} from './pageDocument';
import {validBookDocument} from './sceneDocument';
import {sampleBookOpening,sampleBookCamera,sampleBookStage,type BookCameraStep} from './bookCamera';
import * as THREE from 'three';

describe('page 05 turning grove preview',()=>{
 it('replaces the map with editable multi-direction paper mechanisms',()=>{
  expect(validPageDocument(pages)).toBe(true);expect(validBookDocument(scenes)).toBe(true);
  const document:unknown=pages;if(!validPageDocument(document))throw Error('Invalid pages');
  const page=document.pages.find(p=>p.page===5)!;
  expect(page.controls.filter(c=>c.kind==='text')).toHaveLength(0);
  expect(page.controls.filter(c=>c.popup?.mechanism==='radial')).toHaveLength(8);
  expect(page.contentEpoch).toBeGreaterThan(0);
 });
 it('plays exactly thirty-six seconds, visits the far side and leaves the forest fully open',()=>{
  const document:unknown=scenes;if(!validBookDocument(document))throw Error('Invalid scenes');
  const shots:BookCameraStep[]=document.chapters.flatMap(c=>c.scenes).find(s=>s.page===5)!.shots;
  expect(shots.reduce((n,s)=>n+s.durationMs+s.holdMs,0)).toBe(36000);
  expect(sampleBookOpening(shots,1,0)).toBe(0);expect(sampleBookOpening(shots,1,4500)).toBe(1);expect(sampleBookOpening(shots,1,36000)).toBe(1);expect(sampleBookOpening(shots,1,40000)).toBe(1);
  expect(sampleBookCamera(shots,shots[0].shot,36000).shot).toEqual(shots[shots.length-1].shot);
  const end=sampleBookStage(shots,{},36000);expect(Object.entries(end).every(([id,n])=>n===1)).toBe(true);
  expect(shots.some(s=>s.shot.position[1]<.8&&s.shot.target[1]>s.shot.position[1])).toBe(true);expect(shots.some(s=>s.shot.position[0]<-4)).toBe(true);expect(shots.some(s=>s.shot.position[0]>4&&s.bookOpen===1)).toBe(true);
  const ids=new Set(pages.pages.find(p=>p.page===5)!.controls.map(c=>c.id));for(const s of shots)for(const id of Object.keys(s.stage??{}))expect(ids.has(id)).toBe(true);
 });
 it('flies through both tree walls with low upward looks and a final elevated withdrawal',()=>{
  const shots=scenes.chapters.flatMap(c=>c.scenes).find(s=>s.page===5)!.shots;
  const tour=shots.slice(2,-2).map(s=>s.shot);let travel=0;
  for(let i=1;i<tour.length;i++)travel+=new THREE.Vector3(...tour[i].position).distanceTo(new THREE.Vector3(...tour[i-1].position));
  expect(travel).toBeGreaterThan(20);expect(Math.max(...tour.map(s=>s.position[2]))-Math.min(...tour.map(s=>s.position[2]))).toBeGreaterThan(6);
  expect(tour.filter(s=>s.position[1]<1.2&&s.target[1]>=s.position[1]).length).toBeGreaterThanOrEqual(3);
  expect(shots[shots.length-2].shot.position[1]).toBeGreaterThan(5);expect(shots[shots.length-1].shot.position[2]).toBeGreaterThan(6);expect(shots[shots.length-1].shot.position[1]).toBeGreaterThan(4);
 });
 it('varies traversal speed and preserves continuous motion through the additional swoops',()=>{
  const document:unknown=scenes;if(!validBookDocument(document))throw Error('Invalid scenes');
  const shots=document.chapters.flatMap(c=>c.scenes).find(s=>s.page===5)!.shots;
  const position=(t:number)=>new THREE.Vector3(...sampleBookCamera(shots,shots[0].shot,t).shot.position);
  expect(shots.find(s=>'id' in s&&s.id==='grove-dive')?.shot.position[0]).toBeGreaterThan(0);
  expect(shots.filter(s=>s.path==='spline').length).toBeGreaterThanOrEqual(8);
  const slow=position(8000).distanceTo(position(7000)),fast=position(3200).distanceTo(position(2200));
  expect(fast).toBeGreaterThan(slow);
  let time=0;for(const step of shots){time+=step.durationMs;if(time>2000&&step.holdMs===0&&time<34500){const before=position(time).sub(position(time-1)),after=position(time+1).sub(position(time));expect(before.distanceTo(after)).toBeLessThan(.0002);}time+=step.holdMs;}
  for(let t=2000;t<=36000;t+=25){const shot=sampleBookCamera(shots,shots[0].shot,t).shot;expect(shot.position[1]).toBeGreaterThan(.35);expect(new THREE.Vector3(...shot.position).distanceTo(new THREE.Vector3(...shot.target))).toBeGreaterThan(.5);}
 });
});
