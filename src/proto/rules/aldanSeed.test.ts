import { describe, it, expect } from 'vitest';
import { canPlay, canUseMomentumSkill, createCombatSandboxScenario, endPlayerTurn, enemyTarget, newActor, playCard, useMomentumSkill } from './battle';
import { outcome } from './battleStatuses';
import { actorElements, cardElement, type Element } from './elementSuits';
import { settleTutorial } from './battleTutorials';
import { releaseCir } from './cirCompanion';

const seed = (s: ReturnType<typeof createCombatSandboxScenario>) => s.party.find(a=>a.id==='aldan-seed')!;
const card = (element: Element,rank:number) => { for(let i=0;;i++){const c={id:`seed-${i}`,rank};if(cardElement(c)===element)return c;} };
describe('Aldan Seed expedition foundation',()=>{
 it('opens with Hero leading Dem, Cir and Mochi from the Seed',()=>{
  const s=createCombatSandboxScenario('1002');
  expect(s.party.map(a=>a.id)).toEqual(['aldan-seed','hero','dem','cir','mochi','banks']);
  expect(s.keruExpedition?.leader).toBe('hero');
  expect(s.foes[0]).toMatchObject({id:'dusk-dragon',name:'Dusk Dragon',hp:100,profile:{damage:0}});
  expect(s.tutorial?.breath).toBeDefined();
  expect(seed(s).rank).toBe(2);
  for(const actor of s.party.filter(a=>a.id!=='aldan-seed')){
   expect(actor).toMatchObject({rank:0,foundationCards:[]});
   expect(canPlay(s,actor.id,card('water',3))).toBe(false);
  }
 });
 it('owns the sole tableau rank and AP independently of Hero',()=>{
  let s=createCombatSandboxScenario('1002');const c=card('water',3);
  s={...s,columns:[[c]]};
  expect(seed(s)).toMatchObject({name:'Aldan Seed',hp:40,maxHp:40,rank:2,charge:0});
  expect(s.party.find(a=>a.id==='hero')).toMatchObject({rank:0,foundationCards:[]});
  expect(canPlay(s,'aldan-seed',c)).toBe(true);expect(canPlay(s,'hero',c)).toBe(false);expect(canPlay(s,'hero',c,true)).toBe(false);
  const next=playCard(s,0,'aldan-seed');expect(seed(next)).toMatchObject({rank:3,charge:1,count:1});
  expect(next.party.find(a=>a.id==='hero')).toEqual(s.party.find(a=>a.id==='hero'));
 });
 it('focuses ordinary attacks on the Seed regardless of support AP',()=>{
  let s=createCombatSandboxScenario('1002');s={...s,tutorial:undefined,foes:s.foes.map(f=>({...f,profile:{...f.profile,damage:2}})),party:s.party.map(a=>a.id==='hero'?{...a,charge:99}:a)};
  expect(enemyTarget(s)?.id).toBe('aldan-seed');
  const next=endPlayerTurn(s);expect(seed(next).hp).toBe(38);expect(next.party.find(a=>a.id==='hero')?.hp).toBe(s.party.find(a=>a.id==='hero')?.hp);
 });
 it('moves the same opening Cir between support and familiar without duplication',()=>{
  let s=createCombatSandboxScenario('1002');
  s={...s,party:s.party.map(a=>a.id==='aldan-seed'?{...a,charge:1}:a.id==='cir'?{...a,hp:7}:a)};
  const attached=useMomentumSkill(s,'summon-cir','familiar:aldan-seed');
  expect(attached.party.some(a=>a.id==='cir')).toBe(false);
  expect(attached.cirCompanion?.actor.hp).toBe(7);
  const released=releaseCir(attached);
  expect(released.party.filter(a=>a.id==='cir')).toHaveLength(1);
  expect(released.party.find(a=>a.id==='cir')).toMatchObject({hp:7,rank:0,foundationCards:[]});
 });
 it('ends the expedition on Seed destruction even with surviving Keru',()=>{
  let s=createCombatSandboxScenario('1002');s={...s,tutorial:undefined,foes:s.foes.map(f=>({...f,profile:{...f.profile,damage:2}})),party:s.party.map(a=>a.id==='aldan-seed'?{...a,hp:1}:a)};
  const next=endPlayerTurn(s);expect(next.result).toBe('lost');expect(seed(next).hp).toBe(0);expect(next.party.find(a=>a.id==='hero')!.hp).toBeGreaterThan(0);
  expect(settleTutorial(next).result).toBe('lost');
  expect(outcome({...next,foes:next.foes.map(f=>({...f,hp:0}))})).toBe('lost');
 });
 it('does not lose on support defeat and keeps the Seed usable',()=>{
  let s=createCombatSandboxScenario('1002');s={...s,party:s.party.map(a=>a.id==='dem'?{...a,hp:0}:a)};
  expect(outcome(s)).toBeNull();expect(canPlay(s,'aldan-seed',card('water',3))).toBe(true);
  expect(canUseMomentumSkill(s,'summon-cir',s.foes[0].id)).toBe(true);
 });
 it('uses Seed AP and receipts for familiar placement and activation',()=>{
  let s=createCombatSandboxScenario('1002');s={...s,party:s.party.map(a=>a.id==='aldan-seed'?{...a,charge:1}:a),foes:s.foes.map(f=>({...f,hp:100}))};
  s=useMomentumSkill(s,'summon-cir','familiar:aldan-seed');expect(seed(s).charge).toBe(0);expect(s.cirCompanion).toMatchObject({host:'aldan-seed',pips:0});
  for(const c of [card('air',3),card('water',4)]){s=playCard({...s,columns:[[c]]},0,'aldan-seed');}
  expect(s.cirCompanion?.pips).toBe(3);expect(seed(s).tempHp).toBe(5);expect(actorElements(s,'aldan-seed')).toEqual(['fire','air']);
 });
 it('allows Hearthflame to replenish Seed AP without changing its rank or HP',()=>{
  const s=createCombatSandboxScenario('1002'),next=useMomentumSkill(s,'summon-cir','aldan-seed');
  expect(seed(next)).toMatchObject({charge:3,rank:seed(s).rank,hp:seed(s).hp});expect(next.cirCompanion?.cooldown).toBe(3);
 });
 it('retains legacy actor-foundation scenarios',()=>{
  const s=createCombatSandboxScenario('008');expect(s.party.some(a=>a.id==='aldan-seed')).toBe(false);
  expect(newActor('aldan-seed').name).toBe('Aldan Seed');
 });
});
