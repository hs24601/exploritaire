import { expect, it } from 'vitest';
import { canPlay, canUseMomentumSkill, createCombatSandboxScenario, playCard, useMomentumSkill } from './battle';
import { FOUNDATION_SUMMON_SLOT } from './battleStatusData';

it('Riv costs 1 Hero AP and only accepts the adjacent new-foundation target', () => {
  const base=createCombatSandboxScenario('1000');
  const rich={...base,party:base.party.map(actor=>({...actor,charge:1}))};
  expect(canUseMomentumSkill(base,'summon-riv',FOUNDATION_SUMMON_SLOT)).toBe(false);
  expect(canUseMomentumSkill(rich,'summon-riv','hero')).toBe(false);
  expect(useMomentumSkill(rich,'summon-riv','hero')).toBe(rich);
  const next=useMomentumSkill(rich,'summon-riv',FOUNDATION_SUMMON_SLOT);
  const riv=next.party.find(actor=>actor.id==='riv')!;
  expect(next.party[0].charge).toBe(0);
  expect(riv.foundationCards).toEqual([]);
  expect(riv.rank).toBe(0);
  expect(riv.statuses).toContainEqual({id:'wild'});
  expect(canUseMomentumSkill({...next,party:next.party.map(actor=>({...actor,charge:6}))},'summon-riv',FOUNDATION_SUMMON_SLOT)).toBe(false);
});

it('Riv accepts any first reachable rank, then follows normal rank matching', () => {
  const base=createCombatSandboxScenario('1000');
  const state=useMomentumSkill({...base,party:base.party.map(actor=>({...actor,charge:1}))},'summon-riv',FOUNDATION_SUMMON_SLOT);
  for(let rank=1;rank<=13;rank++) {
    const board={...state,columns:state.columns.map((cards,c)=>c===0?cards.map((card,d)=>d===2?{id:'starter',rank}:card):cards)};
    expect(canPlay(board,'riv',board.columns[0][2])).toBe(true);
  }
  const board={...state,columns:state.columns.map((cards,c)=>c===0?cards.map((card,d)=>d===2?{id:'starter',rank:7}:card):cards)};
  const next=playCard(board,0,'riv');
  const riv=next.party.find(actor=>actor.id==='riv')!;
  expect(riv.rank).toBe(7);
  expect(riv.charge).toBe(1);
  expect(riv.statuses?.some(status=>status.id==='wild')).toBe(false);
  expect(canPlay(next,'riv',{id:'later',rank:9})).toBe(false);
  expect(canPlay(next,'riv',{id:'later',rank:8})).toBe(true);
});

it('Dem also targets a new slot and preserves her Ace start', () => {
  const base=createCombatSandboxScenario('1000');
  const rich={...base,party:base.party.map(actor=>({...actor,charge:6}))};
  expect(canUseMomentumSkill(rich,'hold','hero')).toBe(false);
  expect(useMomentumSkill(rich,'hold',FOUNDATION_SUMMON_SLOT).party.find(actor=>actor.id==='dem')?.rank).toBe(1);
});
