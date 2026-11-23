import {describe,it,expect} from 'vitest';
import {createSpellEtching} from './spellEtching';
describe('spell stardust etching',()=>{
 it('shows a dormant foundation, lights the first receipt immediately, then travels before igniting',()=>{
  const e=createSpellEtching();expect(e.state.lit).toBe(0);e.receipt(1);expect(e.state.lit).toBe(1);
  e.update(2);e.receipt(2);e.update(.2);expect(e.state.lit).toBe(1);expect(e.state.progress).toBeGreaterThan(0);
  e.update(.7);expect(e.state.lit).toBe(2);expect(e.state.progress).toBe(0);
 });
 it('accelerates with receipt cadence and catches up a backlog without dropping stars',()=>{
  const e=createSpellEtching();e.receipt(1);e.update(2);e.receipt(2);const slow=e.state.duration;
  e.update(.1);e.receipt(3);expect(e.state.duration).toBeLessThan(slow);e.receipt(4);
  for(let i=0;i<10;i++)e.update(.05);expect(e.state.lit).toBe(4);expect(e.state.ignited).toHaveLength(4);
 });
 it('snaps under reduced motion and clears all presentation on reset',()=>{
  const e=createSpellEtching();e.receipt(4);e.update(0,true);expect(e.state.lit).toBe(4);e.reset();expect(e.state).toMatchObject({lit:0,target:0,progress:0,ignited:[]});
 });
});
