import { describe, expect, it } from 'vitest';
import { actorAP, canPlay, castBite, createPlayableSandboxScenario, defaultStrike, equipBite, playCard, startBiteBattle } from './battle';
import { carrySeriesParty } from './combatSeries';

const fresh=()=>startBiteBattle(createPlayableSandboxScenario('100'));
describe('Musical Bite foundation',()=>{
 it('starts with Bite prepared on its foundation without a hand card',()=>{
  const state=fresh();expect(state.party[0].rank).toBe(2);expect(canPlay(state,'hero',{id:'ace',rank:1})).toBe(true);
  const equipped=equipBite(state);expect(equipped.party[0].rank).toBe(2);expect(equipped.bite).toEqual({equipped:true,moves:0});expect(equipBite(equipped)).toBe(equipped);
 });
 it('charges for legal moves without chip damage, then attacks freely and resets its accumulated damage',()=>{
  let state=equipBite(fresh());state={...state,columns:[[{id:'three',rank:3}],[{id:'four',rank:4}],[{id:'nine',rank:9}]]};
  const hp=state.foes[0].hp;
  expect(playCard(state,2,'hero')).toBe(state);
  state=playCard(state,0,'hero');state=playCard(state,1,'hero');
  expect(state.foes[0].hp).toBe(hp);expect(state.party[0].rank).toBe(4);expect(state.bite?.moves).toBe(2);expect(actorAP(state,'hero')).toBe(1);
  state=castBite(state,state.foes[0].id);expect(hp-state.foes[0].hp).toBe(2);expect(actorAP(state,'hero')).toBe(1);expect(state.party[0].rank).toBe(2);expect(state.party[0].foundationCards).toEqual([{id:'hero-bite',rank:2}]);expect(state.bite).toEqual({equipped:true,moves:0});
  const equipped=equipBite(state);expect(equipped.party[0].rank).toBe(2);expect(castBite(equipped,equipped.foes[0].id)).toBe(equipped);
 });
 it('works at zero AP and can immediately repeat without cooldown',()=>{
  let state=fresh();state={...state,party:state.party.map(a=>({...a,charge:0}))};
  state={...state,bite:{equipped:true,moves:2},columns:[[{id:'next',rank:3}]]};const first=castBite(state,state.foes[0].id),received=playCard(first,0,'hero'),charged={...received,party:received.party.map(a=>({...a,charge:0}))},second=castBite(charged,charged.foes[0].id);
  expect(first.foes[0].hp).toBe(state.foes[0].hp-2);expect(second.foes[0].hp).toBe(first.foes[0].hp-1);
  expect(actorAP(first,'hero')).toBe(0);expect(actorAP(second,'hero')).toBe(0);expect(second.bite?.moves).toBe(0);
 });
 it('does zero damage before any legal accrual and after consuming the bonus',()=>{const state=fresh();expect(castBite(state,state.foes[0].id)).toBe(state);const charged={...state,bite:{equipped:true,moves:1}};const spent=castBite(charged,charged.foes[0].id);expect(spent.foes[0].hp).toBe(state.foes[0].hp-1);expect(castBite(spent,spent.foes[0].id)).toBe(spent);});
 it('rejects invalid targets and enemy-turn casts without spending or moving Bite',()=>{
  const state=equipBite(fresh());expect(castBite(state,'missing')).toBe(state);
  const enemy={...state,turn:'enemy' as const};expect(castBite(enemy,state.foes[0].id)).toBe(enemy);
 });
 it('retains the ability state across scene progression and the existing chip system elsewhere',()=>{
  const state=equipBite(fresh()),next=carrySeriesParty(state,fresh());expect(next.bite).toEqual(state.bite);
  const legacy=createPlayableSandboxScenario('100');expect(defaultStrike(legacy,'hero').foes[0].hp).toBeLessThan(legacy.foes[0].hp);
 });
});
