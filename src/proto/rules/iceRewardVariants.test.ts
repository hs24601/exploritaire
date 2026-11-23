import { describe, expect, it } from 'vitest';
import { createPlayableSandboxScenario, defaultStrike } from './battle';
import { rollIceRewards } from './iceRewards';
import { summonSnowGolem, castGlacialLance, golemUpkeep, golemFarewell } from './iceAbilities';

describe('ice reward rarity and golem',()=>{
 it('rolls distinct choices and guarantees at least Rare',()=>{
  const choices=rollIceRewards(()=>0);expect(choices).toHaveLength(3);expect(new Set(choices.map(c=>c.id)).size).toBe(3);expect(choices.some(c=>c.tier>0)).toBe(true);
  expect(rollIceRewards(()=>0,0)).toEqual([]);expect(rollIceRewards(()=>0,6)).toHaveLength(6);
 });
 it('summons a playable golem and loses HP only when upkeep is unpaid',()=>{
  let state=createPlayableSandboxScenario('101');state={...state,party:state.party.map(a=>({...a,charge:6,iceRewards:['snow-golem']}))};
  state=summonSnowGolem(state);expect(state.party.find(a=>a.id==='hero')!.charge).toBe(2);
  let golem=state.party.find(a=>a.id==='snow-golem')!;expect(golem.hp).toBe(20);expect(golem.foundationCards?.[0].rank).toBe(golem.rank);expect(golem.iceRewards).toContain('glacial-lance');
  state=golemUpkeep(state);expect(state.party.find(a=>a.id==='snow-golem')!.hp).toBe(20);
  state=golemUpkeep(state);expect(state.party.find(a=>a.id==='snow-golem')!.hp).toBe(15);
  state={...state,party:state.party.map(a=>a.id==='snow-golem'?{...a,charge:2}:a)};
  const hp=state.foes[0].hp;state=castGlacialLance(state,'snow-golem');expect(state.foes[0].hp).toBe(hp-4);expect(state.foes[0].iceFrost).toEqual([2]);
 });
 it('rare golems gain Rime Retort, and legendary farewell damages all survivors once',()=>{
  let state=createPlayableSandboxScenario('101');state={...state,foes:state.foes.map(f=>({...f,hp:40,profile:{...f.profile,maxHp:40}})),party:state.party.map(a=>({...a,charge:6,iceRewards:['snow-golem'],iceRewardTiers:{'snow-golem':3}}))};
  state=summonSnowGolem(state);expect(state.party.find(a=>a.id==='snow-golem')!.iceRewards).toContain('rime-retort');
  state={...state,party:state.party.map(a=>a.id==='snow-golem'?{...a,hp:0}:a)};state=golemFarewell(state);
  expect(state.foes.map(f=>f.hp)).toEqual([15,15]);expect(state.foes.map(f=>f.iceFrost)).toEqual([[2,2],[2,2]]);expect(golemFarewell(state)).toBe(state);
 });
 it('Shatterstrike consumes Frost, adds damage, stagger and vulnerability',()=>{
  let state=createPlayableSandboxScenario('100');state={...state,party:state.party.map(a=>({...a,iceRewards:['shatterstrike']})),foes:state.foes.map(f=>({...f,iceFrost:[2],hp:10}))};
  state=defaultStrike(state,'hero');expect(state.foes[0].hp).toBe(6);expect(state.foes[0].iceFrost).toEqual([]);expect(state.foes[0].iceVulnerable).toBe(2);expect(state.foes[0].stagger).toBe(1);
 });
});
import { iceTier } from './iceRewards';
it('uses the golem’s earned rarity for Glacial Lance and retort',()=>{
 let state=createPlayableSandboxScenario('101');state={...state,foes:state.foes.map(f=>({...f,hp:30,profile:{...f.profile,maxHp:30}})),party:state.party.map(a=>({...a,charge:6,iceRewards:['snow-golem'],iceRewardTiers:{'snow-golem':1}}))};
 state=summonSnowGolem(state);const golem=state.party.find(a=>a.id==='snow-golem')!;expect(golem.iceRewards).toContain('rime-retort');expect(iceTier(golem,'glacial-lance')).toBe(1);
 state={...state,party:state.party.map(a=>a.id==='snow-golem'?{...a,charge:2}:a)};state=castGlacialLance(state,'snow-golem');expect(state.foes[0].hp).toBe(24);
});
it('Shatterstrike vulnerability amplifies a later Glacial Lance Frost application',()=>{
 let state=createPlayableSandboxScenario('100');state={...state,foes:state.foes.map(f=>({...f,hp:30,profile:{...f.profile,maxHp:30},iceFrost:[2]})),party:state.party.map(a=>({...a,charge:4,iceRewards:['shatterstrike','glacial-lance']}))};
 state=defaultStrike(state,'hero');expect(state.foes[0].iceVulnerable).toBe(2);state=castGlacialLance(state,'hero');expect(state.foes[0].iceFrost).toEqual([2,2]);
});
