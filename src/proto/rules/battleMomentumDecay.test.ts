import {describe,it,expect} from 'vitest';
import {createStaggerSandbox,setMomentumDecay,tickBattle,withdrawPlayer,createBattle} from './battle';
// Decay is off by default (Eric, 2026-10-25); these fixtures turn it on to test the drain.
const charged=()=>{const s=createStaggerSandbox();return {...s,momentum:{...s.momentum!,value:4,earned:4,sequence:4,decayEnabled:true}};};
describe('optional Momentum decay',()=>{
 it('defaults off; when on it drains a half point per second without changing earnings or combat',()=>{
  expect(createStaggerSandbox().momentum?.decayEnabled).toBe(false);
  const s=charged(),n=tickBattle(s,1);expect(s.momentum?.decayEnabled).toBe(true);expect(n.momentum).toMatchObject({value:3.5,earned:4,spent:0,sequence:4});
  expect(n.party).toBe(s.party);expect(n.foes).toBe(s.foes);expect(n.columns).toBe(s.columns);expect(n.events).toBe(s.events);
  expect(tickBattle(s,4).momentum?.value).toBe(2);
 });
 it('freezes when disabled and resumes from the same reserve',()=>{
  const s=setMomentumDecay(charged(),false);expect(tickBattle(s,100)).toBe(s);
  const enabled=setMomentumDecay(s,true);expect(tickBattle(enabled,2).momentum?.value).toBe(3);
 });
 it('never underflows or drains during enemy response, victory, invalid time, or ordinary combat',()=>{
  const s=charged();expect(tickBattle(s,100).momentum?.value).toBe(0);
  const pending=withdrawPlayer(s);expect(tickBattle(pending,100)).toBe(pending);
  const won={...s,result:'won' as const};expect(tickBattle(won,100)).toBe(won);
  for(const dt of [0,-1,NaN,Infinity])expect(tickBattle(s,dt)).toBe(s);
  const ordinary=createBattle({tableau:[]});expect(setMomentumDecay(ordinary,true)).toBe(ordinary);
 });
});
