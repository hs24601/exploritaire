import { describe, expect, it } from 'vitest';
import { applyAttack, applyTrap, createBattle, playCard, previewAttack, previewTrap, releaseGrip, tickBattle, type BattleState } from './battle';
const base = (ap=8):BattleState => { const s=createBattle({tableau:[[{id:'three',rank:3}]],stock:[]}); return {...s,party:s.party.map(a=>a.id==='hero'?{...a,charge:ap}:a)}; };
const target=(s:BattleState)=>s.foes[0];
describe('banked AP and chosen abilities',()=>{
 it('spends Nip then a minimum Vice Grip on different targets, retaining four AP',()=>{
  let s=base(); s={...s,foes:s.foes.map((f,i)=>i===0?{...f,hp:1}:f)};
  const preview=previewAttack(s,'hero:Nip','dark-slime')!;
  expect(preview).toMatchObject({damage:1,ko:true});
  s=applyAttack(s,'hero:Nip','dark-slime'); expect(s.party[0].charge).toBe(7);
  s=applyAttack(s,'hero:Vice Grip:3','rear-slime');
  expect(s.party[0].charge).toBe(4); expect(s.foes[1].effects).toContainEqual(expect.objectContaining({kind:'grip',left:7.5}));
  expect(s.party[0]).toMatchObject({rank:2,count:0});
 });
 it('lets Mochi choose a cheap move from a large bank',()=>{
  let s=base(); s={...s,party:s.party.map(a=>a.id==='mochi'?{...a,charge:15}:a)};
  s=applyAttack(s,'mochi:Scratch','dark-slime'); expect(s.party[1].charge).toBe(14);
  s=applyAttack(s,'mochi:Lacerate','rear-slime'); expect(s.party[1].charge).toBe(7);
  expect(s.foes[1].effects.some(e=>e.kind==='bleed')).toBe(true);
 });
 it('banks beyond ten and refuses unaffordable or unknown abilities',()=>{
  expect(playCard(base(25),0,'hero').party[0].charge).toBe(26);
  const s=base(2); expect(applyAttack(s,'hero:Bite','dark-slime')).toBe(s);
  expect(applyAttack(s,'hero:unknown','dark-slime')).toBe(s);
 });
 it('rolls bleeding, grants Nip bonus, refreshes rather than stacks',()=>{
  let s=applyAttack(base(12),'hero:Bite','dark-slime');
  expect(s.party[0].charge).toBe(9); expect(target(s).hp).toBe(12);
  expect(previewAttack(s,'hero:Nip','dark-slime')!.damage).toBe(2);
  s=applyAttack(s,'hero:Bite','dark-slime'); expect(target(s).effects.filter(e=>e.kind==='bleed')).toHaveLength(1);
  const hp=target(s).hp; s=tickBattle(s,4); expect(target(s).hp).toBe(hp-4);
  expect(target(s).effects.map(e=>e.kind)).toEqual(['exposed']);
 });
 it('stuns for exactly two seconds without stagger vulnerability and resumes after expiry',()=>{
  let s=applyAttack(base(),'hero:Takedown','dark-slime');
  expect(target(s)).toMatchObject({hp:11,staggered:0});
  s=tickBattle(s,1); expect(target(s).timer).toBe(0);
  s=tickBattle(s,2); expect(target(s).timer).toBeCloseTo(1/7);
 });
 it('extends a hold once per added card without spending its new AP',()=>{
  let s=applyAttack(base(),'hero:Vice Grip:3','dark-slime');
  s=tickBattle(s,2); s=playCard(s,0,'hero');
  expect(s.party[0].charge).toBe(6); expect(target(s).effects[0].left).toBe(6.25);
  expect(target(tickBattle(s,6)).timer).toBe(0);
 });
 it('commits extra AP and cancels a hold on another attack or explicit release',()=>{
  let s=applyAttack(base(),'hero:Vice Grip:5','dark-slime');
  expect(s.party[0].charge).toBe(3); expect(target(s).effects[0].left).toBe(8.625);
  expect(target(releaseGrip(s,'hero')).effects).toEqual([]);
  s=applyAttack(s,'hero:Nip','rear-slime'); expect(target(s).effects).toEqual([]);
 });
 it('clears a hold when its actor goes down; other actors attacks preserve it',()=>{
  let s=applyAttack(base(),'hero:Vice Grip:3','dark-slime');
  s={...s,party:s.party.map(a=>a.id==='mochi'?{...a,charge:1}:a)};
  s=applyAttack(s,'mochi','dark-slime'); expect(target(s).effects.some(e=>e.kind==='grip')).toBe(true);
  s={...s,party:s.party.map(a=>a.id==='hero'?{...a,hp:0}:a)};
  expect(target(tickBattle(s,1)).effects).toEqual([]);
 });
 it('sets chosen fixed-cost traps but disallows sustained holds as traps',()=>{
  let s=base(); s={...s,rules:{hungry:true,traps:true}};
  expect(previewTrap(s,'hero:Vice Grip:3',0)).toBeNull();
  expect(applyTrap(s,'hero:Vice Grip:3',0)).toBe(s);
  s=applyTrap(s,'hero:Bite',0); expect(s.party[0].charge).toBe(5);
  expect(s.traps.three).toMatchObject({actorId:'hero',name:'Bite'});
 });
});
