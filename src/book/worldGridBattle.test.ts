import {describe,it,expect} from 'vitest';
import {createWorldRailBattle} from './worldRailBattle';
import {receiveWorldGridCard,moveWorldGridFoundation} from './worldGridBattle';
import {apCap,defaultStrike,receiveCard} from '../proto/rules/battle';
const card=(rank:number)=>({id:'grid-test-'+rank,rank,suit:0});
describe('world grid combat receipts',()=>{
 it('moves the foundation immediately and ends the turn without awarding receipt AP or chip damage',()=>{
  const state=createWorldRailBattle(),next=moveWorldGridFoundation(state,card(11));expect(next.party[0].rank).toBe(11);expect(next.turn).toBe('enemy');expect(next.party[0].charge).toBe(state.party[0].charge);expect(next.foes[0].hp).toBe(state.foes[0].hp);
  const enemy={...state,turn:'enemy' as const};expect(moveWorldGridFoundation(enemy,card(11))).toBe(enemy);
 });
 it('chooses a starting value and draws stock without AP or chip hits',()=>{
  const state=createWorldRailBattle(),hero=state.party[0];
  for(const kind of ['start','stock'] as const){const next=receiveWorldGridCard(state,card(12),kind);expect(next.party[0].rank).toBe(12);expect(next.party[0].charge).toBe(hero.charge);expect(next.foes).toEqual(state.foes);}
 });
 it('earns canonical AP for legal receipts including A/K wrap without chip damage or stagger',()=>{
  const state=createWorldRailBattle();state.party[0]={...state.party[0],rank:13,charge:0};
  expect(receiveWorldGridCard(state,card(5),'play')).toBe(state);
  const next=receiveWorldGridCard(state,card(1),'play');expect(next.party[0].rank).toBe(1);expect(next.party[0].charge).toBeGreaterThan(0);expect(next.foes).toEqual(state.foes);expect(next.columns).toBe(state.columns);expect(next.rules.autoStrike).toBe(true);
 });
 it('suppresses full-AP receipt attacks while retaining explicit attacks and default Proto receipts',()=>{
  const state=createWorldRailBattle();state.party[0]={...state.party[0],rank:5,charge:apCap(state.party[0])};
  const next=receiveWorldGridCard(state,card(6),'play');expect(next.party[0].charge).toBe(apCap(state.party[0]));expect(next.foes).toEqual(state.foes);expect(next.result).toBe(state.result);
  expect(defaultStrike(next,'hero',{name:'Test skill',damage:3,stagger:0}).foes[0].hp).toBeLessThan(next.foes[0].hp);
  expect(receiveCard(state,'hero',{card:card(6),columns:state.columns,stock:state.stock,dealt:state.dealt}).foes[0].hp).toBeLessThan(state.foes[0].hp);
 });
 it('refuses all transitions during enemy turns and after a result',()=>{
  const state=createWorldRailBattle();for(const kind of ['start','play','stock'] as const){const enemy={...state,turn:'enemy' as const};expect(receiveWorldGridCard(enemy,card(3),kind)).toBe(enemy);const won={...state,result:'won' as const};expect(receiveWorldGridCard(won,card(3),kind)).toBe(won);}
 });
});
