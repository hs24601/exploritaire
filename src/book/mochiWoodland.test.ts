import {describe,it,expect} from 'vitest';
import * as THREE from 'three';
import {MOCHI_MOMENTS,MOCHI_WOODLAND_MS,MOCHI_PAINT_END,mochiMoment} from './mochiWoodland';
import {woodlandDuration,woodlandPaintEnd,woodlandVisualTime} from './heroWoodland';
import {sampleBookOpening,sampleBookStage,sampleBookCamera} from './bookCamera';
import {forestPaintProgress} from './forestPaint';
import {magicPopupOpen} from './bookMagic';
import {createTreePerchPopup} from './treePerchPopup';
import {DEFAULT_POPUP,validPageDocument,type BookPageDocument} from './pageDocument';
import {validBookDocument,type BookSceneDocument} from './sceneDocument';
import source from '../data/bookPages.json';
import sceneSource from '../data/bookScenes.json';
const pages=source as BookPageDocument,scenes=sceneSource as BookSceneDocument;
const page=pages.pages.find(p=>p.page===4)!,scene=scenes.chapters.flatMap(c=>c.scenes).find(s=>s.page===4)!;
const painting=(width:number,height:number)=>({width,height,getContext:()=>({getImageData:()=>({data:new Uint8ClampedArray(width*height*4).fill(255)})})}) as unknown as HTMLCanvasElement;

describe('Mochi’s page 04 woodland',()=>{
 it('adds a 50-second edition while preserving the earlier film lengths and sketch preview',()=>{
  expect(validPageDocument(source)).toBe(true);expect(validBookDocument(sceneSource)).toBe(true);
  expect([1,2,3].map(woodlandDuration)).toEqual([20000,40000,50000]);
  expect(scene.shots.reduce((n,s)=>n+s.durationMs+s.holdMs,0)).toBe(MOCHI_WOODLAND_MS);
  expect(sampleBookOpening(scene.shots,1,2000)).toBe(1);expect(Object.values(sampleBookStage(scene.shots,{},2000)).every(n=>n===0)).toBe(true);
  expect(sampleBookOpening(scene.shots,1,3500)).toBe(0);expect(sampleBookOpening(scene.shots,1,50000)).toBe(0);
  expect(forestPaintProgress(MOCHI_PAINT_END,woodlandPaintEnd(3))).toBe(1);expect(woodlandVisualTime(3,50)).toBe(20);
 });
 it('keeps Mochi absent in the preview and exposes only the current posed moment',()=>{
  for(let t=0;t<=50;t+=.025){const shown=MOCHI_MOMENTS.filter(m=>mochiMoment(m.id,t).visible);expect(shown.length).toBeLessThanOrEqual(1);if(t<8.3)expect(shown).toHaveLength(0);}
  for(const m of MOCHI_MOMENTS)expect(mochiMoment(m.id,(m.start+m.end)/2).open).toBe(1);
  expect(MOCHI_MOMENTS.find(m=>m.id==='mochi4-tree')!.end-MOCHI_MOMENTS.find(m=>m.id==='mochi4-tree')!.start).toBeGreaterThan(9);
 });
 it('authors four ground poses and one combined tree companion, without Hero or textboxes',()=>{
  expect(page.controls.some(c=>c.kind==='text'||c.id.startsWith('hero3-'))).toBe(false);
  expect(page.controls.filter(c=>c.popup?.mechanism==='extension')).toHaveLength(2);
  expect(page.controls.filter(c=>c.popup?.mechanism==='tree-perch')).toHaveLength(1);
  const tree=page.controls.find(c=>c.id==='mochi4-tree')!;
  expect(tree.art).toContain('pine-relief');expect(tree.popup!.companionArt).toContain('mochi-happy-perch');
  for(const m of MOCHI_MOMENTS){const c=page.controls.find(c=>c.id===m.id)!;expect(c.kind).toBe('popup');const mid=(m.start+m.end)/2,shot=sampleBookCamera(scene.shots,scene.shots[0].shot,mid*1000).shot;
   const paint=forestPaintProgress(mid,woodlandPaintEnd(3));expect(Math.min(magicPopupOpen(paint,c.x,c.z,c.height),mochiMoment(c.id,mid).open),m.id+' fully deployed during its hold').toBe(1);
   expect(shot.fov).toBeLessThanOrEqual(40);expect(Math.abs(shot.target[2]-c.z)).toBeLessThan(.01);
   if(m.id==='mochi4-tree'){expect(shot.target[1]).toBeGreaterThan(1.5);expect(Math.abs(shot.target[0]-c.x)).toBeLessThan(.5);}else expect(shot.target[0]).toBe(c.x);
  }
 });
 it('rejects a combined pattern without a local companion painting or with a spine mount',()=>{
  for(const patch of [{companionArt:undefined},{companionArt:'../private.png'},{companionArt:'https://example.com/cat.png'},{mount:'spine'}]){const d=structuredClone(pages),tree=d.pages.find(p=>p.page===4)!.controls.find(c=>c.id==='mochi4-tree')!;Object.assign(tree.popup!,patch);expect(validPageDocument(d)).toBe(false);}
 });
 it('physically carries both paintings on the same rigid crease leaves in either opening direction',()=>{
  const tree=createTreePerchPopup(painting(64,128),painting(96,64),{height:3.15,...DEFAULT_POPUP,alpha:65*Math.PI/180});
  try{
   expect(tree.root.userData.connectedPaper).toBe(true);expect(tree.leaves).toHaveLength(2);
   const attachments=tree.leaves!.map(leaf=>leaf.getObjectByName('mochi-perch-paint')!);
   const local=attachments.map(p=>p.position.clone()),sample=new THREE.Vector3(.2,.3,0);
   for(const n of [0,.1,.4,.7,1,.7,.4,.1,0]){tree.pose(n);tree.root.updateWorldMatrix(true,true);
    attachments.forEach((cat,i)=>{expect(cat.parent).toBe(tree.leaves![i]);expect(cat.position.distanceTo(local[i])).toBe(0);const a=cat.localToWorld(new THREE.Vector3()),b=cat.localToWorld(sample.clone());expect(a.distanceTo(b)).toBeCloseTo(sample.length(),7);if(n===0)expect(Math.abs(a.y)).toBeLessThan(.04);});
   }
  }finally{tree.dispose();}
 });
});
