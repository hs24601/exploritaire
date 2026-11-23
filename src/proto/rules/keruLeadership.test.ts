import { describe, it, expect } from 'vitest';
import { canPlay, createBattle, createCombatSandboxScenario, playCard, returnPlayerTurn } from './battle';
import { canTapIn, enterKeruEncounter, initialKeruExpedition, keruExpeditionSnapshot, personalValue, tapInKeru } from './keruLeadership';
const start=()=>({...createCombatSandboxScenario('1002'),columns:[[{id:'exposed-six',rank:6}]]});

it('lets fifth member Banks swap into the Seed using his personal nine',()=>{
 const state={...start(),columns:[[{id:'exposed-eight',rank:8}]]};
 expect(state.party.some(actor=>actor.id==='banks')).toBe(true);
 expect(canTapIn(state,'banks')).toBe(true);
 const next=tapInKeru(state,'banks');
 expect(next.keruExpedition?.leader).toBe('banks');
 expect(next.party.find(actor=>actor.id==='aldan-seed')?.rank).toBe(9);
 expect(next.party).toHaveLength(6);
 expect(next.columns).toEqual(state.columns);
 expect(next.party.find(actor=>actor.id==='banks')).toEqual(state.party.find(actor=>actor.id==='banks'));
 expect(canTapIn(next,'hero')).toBe(false);
 expect(keruExpeditionSnapshot(next)?.leader).toBe('banks');
});
const seed=(s:ReturnType<typeof start>)=>s.party.find(a=>a.id==='aldan-seed')!;
describe('single-foundation Keru leadership',()=>{
 it('requires adjacency to an exposed card, ignoring buried cards and the current Seed rank',()=>{
  const s=start();expect(personalValue(s,'cir')).toBe(7);expect(canTapIn(s,'cir')).toBe(true);
  expect(canTapIn({...s,columns:[[{id:'buried',rank:6},{id:'exposed',rank:10}]]},'cir')).toBe(false);
  expect(canTapIn({...s,columns:[]},'cir')).toBe(false);
 });
 it('swaps only the leader/value without consuming a card, healing or granting resources',()=>{
  let s=start();s={...s,party:s.party.map(a=>a.id==='aldan-seed'?{...a,hp:23,charge:2}:a)};
  const next=tapInKeru(s,'cir');expect(next.keruExpedition?.leader).toBe('cir');expect(seed(next)).toMatchObject({rank:7,hp:23,charge:2,count:0});
  expect(next.columns).toBe(s.columns);expect(next.foes).toBe(s.foes);expect(next.events).toBe(s.events);expect(next.momentum).toBe(s.momentum);
  expect(next.party.filter(a=>canPlay(next,a.id,{id:'next',rank:8})).map(a=>a.id)).toEqual(['aldan-seed']);
 });
 it('enforces a team-wide once-per-turn allowance that resets at the next party opening',()=>{
  const s=tapInKeru(start(),'cir');const suitable={...s,columns:[[{id:'king',rank:13}]]};
  expect(canTapIn(suitable,'dem')).toBe(false);expect(tapInKeru(suitable,'dem')).toBe(suitable);
  const next={...returnPlayerTurn(suitable),columns:suitable.columns};expect(next.keruTapInUsed).toBe(false);expect(canTapIn(next,'dem')).toBe(true);
 });
 it('supports A/K wrapping and rejects enemy-turn, unavailable and committed Keru',()=>{
  const s={...start(),columns:[[{id:'king',rank:13}]]};expect(canTapIn(s,'dem')).toBe(true);
  expect(canTapIn({...s,turn:'enemy'},'dem')).toBe(false);
  const cir=tapInKeru(start(),'cir');expect(canTapIn(cir,'cir')).toBe(false);
  const down={...start(),party:start().party.map(a=>a.id==='cir'?{...a,hp:0}:a)};expect(canTapIn(down,'cir')).toBe(false);
 });
 it('remembers receipt values when a leader switches out and back in',()=>{
  let s=tapInKeru(start(),'cir');s=playCard({...s,columns:[[{id:'eight',rank:8}]]},0,'aldan-seed');
  expect(s.keruExpedition?.values.cir).toBe(8);
  s={...returnPlayerTurn(s),columns:[[{id:'three',rank:3}]]};s=tapInKeru(s,'hero');expect(seed(s).rank).toBe(2);
  s={...returnPlayerTurn(s),columns:[[{id:'nine',rank:9}]]};s=tapInKeru(s,'cir');expect(seed(s).rank).toBe(8);
  const stack=seed(s).foundationCards!;expect(stack[stack.length-1].id).toBe('eight');
 });
 it('carries personal values into a non-sandbox encounter via a JSON-safe expedition save',()=>{
  let s=tapInKeru(start(),'cir');s=playCard({...s,columns:[[{id:'eight',rank:8}]]},0,'aldan-seed');
  const saved=JSON.parse(JSON.stringify(keruExpeditionSnapshot(s)));
  const next=createBattle({tableau:[[{id:'nine',rank:9}]]},{keruExpedition:saved});
  expect(next.sandboxScenario).toBeUndefined();expect(next.keruExpedition?.leader).toBe('cir');expect(seed(next).rank).toBe(8);expect(next.keruTapInUsed).toBe(false);
  expect(seed(createCombatSandboxScenario('1002')).rank).toBe(2);
 });
 it('normalizes invalid saved ranks and never changes the caller’s saved object',()=>{
  const saved=initialKeruExpedition();saved.values.cir=99;
  const next=enterKeruEncounter(start(),saved);expect(personalValue(next,'cir')).toBe(7);expect(saved.values.cir).toBe(99);
 });
});
