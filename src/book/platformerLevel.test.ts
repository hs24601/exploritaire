import {describe,it,expect} from 'vitest';
import {TEXT_LEDGES,TextPlatformJourney,findTextRoute,platformLyricLines,PLATFORM_BOOK as B} from './platformerLevel';
describe('Page 22 text terrain',()=>{
 it('preserves the supplied lyrics and original line breaks across terrain fragments',()=>{
  expect(platformLyricLines()).toEqual([
   'Alegría, come un lampo di vita','Alegría, come un pazzo gridar','Alegría, del delittuoso grido','Bella ruggente pena, seren','Come la rabbia di amar','Alegría, come un assalto di gioia',
   'Alegría, I see a spark of life shining','Alegría, I hear a young minstrel sing','Alegría, beautiful roaring scream','Of joy and sorrow so extreme','There is a love in me raging','Alegría, a joyous, magical feeling',
   'Alegría, come un lampo di vita','Alegría, come un pazzo gridar','Alegría, del delittuoso grido','Bella ruggente pena, seren','Come la rabbia di amar','Alegría, come un assalto di gioia',
   'Del delittuoso grido','Bella ruggente pena, seren','Come la rabbia di amar','Alegría, come un assalto di gioia',
  ]);
 });
 it('takes the complete descent, gutter, vine ascent and second descent to the finish',()=>{
  const journey=new TextPlatformJourney();expect(journey.navigate('b-finish')).toBe(true);const seen=new Set<string>();
  for(let i=0;i<20000&&!journey.completed;i++){
   journey.update(1/60);seen.add(journey.motion);expect(journey.x).toBeGreaterThan(B.left);expect(journey.x).toBeLessThan(B.width-B.left);expect(journey.y).toBeGreaterThan(B.top);expect(journey.y).toBeLessThan(1030);
  }
  expect(journey.completed).toBe(true);expect(journey.visited.size).toBe(TEXT_LEDGES.length);
  expect(seen.has('climb')).toBe(true);expect(seen.has('jump')).toBe(true);expect(seen.has('crawl')).toBe(true);expect(seen.has('fall')).toBe(true);
  expect(journey.surface).toBe('b-finish');expect(journey.checkpoint).toBe('b-top');
 });
 it('makes the upper-left of B reachable only through the bottom gutter and ascent',()=>{
  const path=findTextRoute('a-start','b-top')!;expect(path.some(p=>p.to==='a-exit')).toBe(true);expect(path.some(p=>p.to==='gutter')).toBe(true);
  expect(path.filter(p=>p.kind==='climb')).toHaveLength(5);expect(findTextRoute('a-start','missing')).toBe(null);
 });
 it('replans a mid-jump click after landing, never teleporting the actor',()=>{
  const j=new TextPlatformJourney();j.navigate('b-finish');while(j.motion!=='hurdle')j.update(.05);const before={x:j.x,y:j.y};j.navigate('a-start');expect(j.x).toBe(before.x);expect(j.y).toBe(before.y);
  for(let i=0;i<4000&&j.travelling;i++)j.update(1/60);expect(j.surface).toBe('a-start');expect(j.motion).toBe('idle');
 });
 it('preserves checkpoint state and resets a fresh journey independently',()=>{
  const j=new TextPlatformJourney();j.navigate('b-top');for(let i=0;i<10000&&j.travelling;i++)j.update(.02);expect(j.checkpoint).toBe('b-top');j.navigate('b-drop');j.update(.2);j.restart(true);expect(j.surface).toBe('b-top');j.restart();expect(j.surface).toBe('a-start');expect(j.visited.size).toBe(1);
 });
});
