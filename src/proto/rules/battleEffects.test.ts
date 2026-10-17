import {describe,it,expect} from 'vitest';
import {applyHitEffects} from './battleEffects';
import {gripDuration} from './battleAbilities';
import {applyAttack,createBattle,previewAttack,tickBattle,type BattleState} from './battle';
const base=():BattleState=>{const s=createBattle({tableau:[],stock:[]});return {...s,effectSeed:100,party:s.party.map(a=>({...a,charge:20}))};};
describe('Exposed and bleed rolls',()=>{
 it('Bite does 2 damage, can fail its 25% roll, and always applies Exposed for six seconds',()=>{
  const s=applyAttack(base(),'hero:Bite','dark-slime');expect(s.foes[0].hp).toBe(12);
  expect(s.foes[0].effects).toMatchObject([{kind:'exposed',left:6}]);
 });
 it.each(['hero:Nip','mochi:Scratch'])('a subsequent %s can cause bleeding via Exposed',key=>{
  let s=applyAttack(base(),'hero:Bite','dark-slime');s={...s,effectSeed:2100};
  s=applyAttack(s,key,'dark-slime');expect(s.foes[0].effects.some(e=>e.kind==='bleed')).toBe(true);
 });
 it('adds ten percentage points, without ramping or refreshing Exposed on other hits',()=>{
  const exposed={kind:'exposed' as const,dps:0,seconds:6,left:3,tickIn:1};
  const bleed={kind:'bleed' as const,dps:1,seconds:4,chance:.25};
  expect(applyHitEffects([], [bleed],100).effects).toEqual([]);
  expect(applyHitEffects([exposed], [bleed],100).effects.some(e=>e.kind==='bleed')).toBe(true);
  expect(applyHitEffects([exposed], [],100).effects).toEqual([exposed]);
 });
 it('preview never consumes rolls, DoT never triggers rolls, and susceptibility expires',()=>{
  let s=base();const seed=s.effectSeed;previewAttack(s,'hero:Bite','dark-slime');expect(s.effectSeed).toBe(seed);
  s=applyAttack(s,'hero:Bite','dark-slime');const afterSeed=s.effectSeed;s=tickBattle(s,6);
  expect(s.effectSeed).toBe(afterSeed);expect(s.foes[0].effects).toEqual([]);
  s={...s,effectSeed:2100};s=applyAttack(s,'hero:Nip','dark-slime');expect(s.foes[0].effects).toEqual([]);
 });
 it('Takedown cancels the pending attack and forage tell, then holds for two seconds',()=>{
  let s=base();s={...s,foes:s.foes.map(f=>({...f,timer:.99,eye:{cardId:'x',column:0,left:.1,total:1}}))};
  s=applyAttack(s,'hero:Takedown','dark-slime');expect(s.foes[0]).toMatchObject({timer:0,eye:null});
  expect(tickBattle(s,2).foes[0].timer).toBe(0);expect(tickBattle(s,3).foes[0].timer).toBeCloseTo(1/7);
 });
});
describe('Vice Grip diminishing returns',()=>{
 it('uses full duration through six seconds then halves each extra block',()=>{
  expect([3,6,9,12,15].map(gripDuration)).toEqual([3,6,7.5,8.25,8.625]);
  expect(gripDuration(7)).toBe(6.5);expect(gripDuration(300)).toBeLessThanOrEqual(9);
 });
});
