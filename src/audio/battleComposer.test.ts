import {describe,it,expect} from 'vitest';
import {composeBattleTheme,combatReceiptVoicing,HarmonyGuard,pitchesClash,gentlePitchClasses} from './battleComposer';
describe('battle composer',()=>{
 it('develops repeated values by phrase position and avoids ascending value-to-scale mapping',()=>{
  const key={root:62,mode:'aeolian' as const},theme=composeBattleTheme('row1:2|7|11|3',key);
  const repeated=Array.from({length:16},(_,i)=>combatReceiptVoicing(theme,5,i).midi);
  expect(new Set(repeated).size).toBeGreaterThan(3);
  const ranks=Array.from({length:13},(_,i)=>combatReceiptVoicing(theme,i+1,0).midi);
  expect(ranks.some((n,i)=>i>0&&n<ranks[i-1])).toBe(true);
  expect(new Set(ranks).size).toBeLessThan(13);
  const other=composeBattleTheme('row1:9|1|4|12',key);
  expect(Array.from({length:16},(_,i)=>combatReceiptVoicing(other,5,i).midi)).not.toEqual(repeated);
  expect(combatReceiptVoicing(theme,7,8)).toEqual(combatReceiptVoicing(theme,7,8));
  expect(combatReceiptVoicing(theme,7,2,.9).midi).not.toBe(combatReceiptVoicing(theme,7,2,0).midi);
 });
 it('accepts numeric/alphanumeric seeds and reproduces variations',()=>{const key={root:62,mode:'aeolian' as const};expect(composeBattleTheme(123,key)).toEqual(composeBattleTheme('123',key));expect(composeBattleTheme('Hero42',key)).toEqual(composeBattleTheme('Hero42',key));expect(composeBattleTheme('Hero42',key,1).melody).not.toEqual(composeBattleTheme('Hero42',key).melody);});
 it('keeps thousands of themes within a semitone/tritone-free collection',()=>{for(const mode of ['aeolian','lydian'] as const)for(let seed=0;seed<1000;seed++){const key={root:62,mode},t=composeBattleTheme(seed,key),notes=[...t.melody,...t.chords.flat(),...t.bass];expect(t.melody).toHaveLength(16);const classes=[...new Set(notes.map(n=>n%12))];expect(classes.every(n=>gentlePitchClasses(key).includes(n))).toBe(true);expect(classes.every(a=>classes.every(b=>![1,6,11].includes(Math.abs(a-b)%12)))).toBe(true);}});
 it('protects overlapping releases, future notes and key changes; rests when blocked',()=>{const guard=new HarmonyGuard();for(let i=0;i<180;i++){const at=i*.08,key={root:i<90?62:63,mode:'aeolian' as const};guard.protect(36+i%55,at,1,key,at,36,88);const notes=guard.scheduled;for(let a=0;a<notes.length;a++)for(let b=a+1;b<notes.length;b++)if(notes[a].start<notes[b].end&&notes[b].start<notes[a].end)expect(pitchesClash(notes[a].midi,notes[b].midi)).toBe(false);}const blocked=new HarmonyGuard();blocked.protect(62,1,2,{root:62,mode:'aeolian'},0,62,62);expect(blocked.protect(63,1,1,{root:63,mode:'aeolian'},0,63,63)).toBeUndefined();});
});
