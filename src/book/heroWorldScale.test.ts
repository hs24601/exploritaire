import {describe,it,expect} from 'vitest';
import {HERO_WORLD_ACTIONS,HERO_WORLD_VIEWS,heroWorldActionFrame} from './heroWorldActions';
import packing from '../../public/assets/sources/characters/hero/world-exploration/v1/manifest.json';
import combatPacking from '../../public/assets/sources/characters/hero/world-combat/v3/manifest.json';
import refreshedPacking from '../../public/assets/sources/characters/hero/world-exploration/v2/manifest.json';
import baseline from '../../public/assets/sources/characters/hero/castle/activities-v1/manifest.json';
describe('Hero world action physical scale',()=>{
 it('matches each clip neutral footprint to the existing Hero instead of its sheet cell',()=>{
  for(const id of HERO_WORLD_ACTIONS)for(const key of HERO_WORLD_VIEWS){
   const referenceId=['mantle','climb90'].includes(id)?'bound':id;
   const clips=[...packing.clips.filter(c=>c.id!=='yawn'),...refreshedPacking.clips,...combatPacking.clips];
   const ref=clips.find(c=>c.id===referenceId)!.registration.find(r=>r.view===key)!;
   const own=clips.find(c=>c.id===id)!.registration.find(r=>r.view===key)!;
   const b=ref.sourceBounds[0],group=HERO_WORLD_VIEWS.indexOf(key),elevation=group===10?1.5:group>=5?1:.1;
   const pose=heroWorldActionFrame(id,0,0,(group%5)*Math.PI/4,elevation);
   const actual=Math.max(b.width,b.height)*own.scale/pose.atlas.cell*pose.planeSize;
   const prior=Math.max(...baseline.views[key].packing[id==='roll'?5:0].size)/256*baseline.planeSizeMeters;
   expect(actual).toBeCloseTo(prior,5);
   for(const t of [.1,.3,.8,1.3])expect(heroWorldActionFrame(id,t,0,(group%5)*Math.PI/4,elevation).planeSize).toBe(pose.planeSize);
  }
 });
 it('uses original seated proportions for roll instead of enlarging it to standing height',()=>{
  const roll=packing.clips.find(c=>c.id==='roll')!.registration.find(r=>r.view==='low-0')!;
  const first=roll.sourceBounds[0],pose=heroWorldActionFrame('roll',0,0,0,.1);
  const paintedHeight=first.height*roll.scale/pose.atlas.cell*pose.planeSize;
  const seated=baseline.views['low-0'].packing[5].size;
  const standing=baseline.views['low-0'].packing[0].size;
  expect(paintedHeight).toBeCloseTo(Math.max(...seated)/256*baseline.planeSizeMeters,2);
  expect(paintedHeight).toBeLessThan(Math.max(...standing)/256*baseline.planeSizeMeters);
 });
 it('samples regenerated faces at native higher resolution without changing old action UVs',()=>{
  for(const id of ['combatReady','combatStalk','combatBow','combatLeap','yawn'] as const){
   const pose=heroWorldActionFrame(id,0,0,0,.1);
   expect(pose.atlas.cell).toBe(256);expect(pose.rect[2]).toBe(256);
   expect(pose.atlas.width).toBe(2048);
  }
  expect(heroWorldActionFrame('roll',0,0,0,.1).atlas.cell).toBe(192);
 });
});
