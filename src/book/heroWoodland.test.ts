import {describe,it,expect} from 'vitest';
import {HERO_MOMENTS,HERO_WOODLAND_MS,heroMoment,woodlandPaintEnd} from './heroWoodland';
import {sampleBookOpening,sampleBookStage,sampleBookCamera} from './bookCamera';
import {validBookDocument,type BookSceneDocument} from './sceneDocument';
import {validPageDocument,type BookPageDocument} from './pageDocument';
import {forestPaintProgress} from './forestPaint';
import pageSource from '../data/bookPages.json';
import sceneSource from '../data/bookScenes.json';
const pages=pageSource as unknown as BookPageDocument,scenes=sceneSource as unknown as BookSceneDocument;

describe('page 03 Hero woodland edition',()=>{
 it('retains a separate 20-second page 02 and a 40-second Hero edition',()=>{
  expect(validPageDocument(pageSource)).toBe(true);expect(validBookDocument(sceneSource)).toBe(true);
  const all=scenes.chapters.flatMap(c=>c.scenes),base=all.find(s=>s.page===2)!,hero=all.find(s=>s.page===3)!;
  expect(base.shots.reduce((n,s)=>n+s.durationMs+s.holdMs,0)).toBe(20000);expect(hero.shots.reduce((n,s)=>n+s.durationMs+s.holdMs,0)).toBe(HERO_WOODLAND_MS);
  expect(sampleBookOpening(hero.shots,1,2000)).toBe(1);expect(Object.values(sampleBookStage(hero.shots,{},2000)).every(n=>n===0)).toBe(true);expect(sampleBookOpening(hero.shots,1,HERO_WOODLAND_MS)).toBe(0);
 });
 it('places four generated Hero poses among the duplicated forest set pieces without prose',()=>{
  const page=pages.pages.find(p=>p.page===3)!;expect(page.controls.some(c=>c.kind==='text')).toBe(false);
  expect(page.controls.filter(c=>c.popup?.mechanism==='extension')).toHaveLength(2);
  for(const m of HERO_MOMENTS){const c=page.controls.find(c=>c.id===m.id)!;expect(c.art).toContain('kin/hero/sprites/world/storybook-woodland-poses/');expect(c.kind).toBe('popup');}
 });
 it('never exposes Hero in the first pass and never shows two moments at once',()=>{
  for(let t=0;t<=40;t+=.05){const visible=HERO_MOMENTS.filter(m=>heroMoment(m.id,t).visible);expect(visible.length).toBeLessThanOrEqual(1);if(t<8.3)expect(visible).toHaveLength(0);}
  for(const m of HERO_MOMENTS){const mid=(m.start+m.end)/2;expect(heroMoment(m.id,mid).open).toBe(1);}
  expect(forestPaintProgress(8.3,woodlandPaintEnd(2))).toBe(0);expect(forestPaintProgress(34.8,woodlandPaintEnd(2))).toBe(1);
 });
 it('holds a close camera on each pose with room for its full silhouette',()=>{
  const scene=scenes.chapters.flatMap(c=>c.scenes).find(s=>s.page===3)!,page=pages.pages.find(p=>p.page===3)!;
  for(const m of HERO_MOMENTS){const control=page.controls.find(c=>c.id===m.id)!,time=(m.start+m.end)/2*1000,shot=sampleBookCamera(scene.shots,scene.shots[0].shot,time).shot;expect(Math.hypot(shot.target[0]-control.x,shot.target[2]-control.z)).toBeLessThan(.01);expect(shot.fov).toBeLessThanOrEqual(40);}
 });
});
