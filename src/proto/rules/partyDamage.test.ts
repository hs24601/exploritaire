import { describe, it, expect } from 'vitest';
import { actorAttack, applyAttack, createCombatSandboxScenario, newActor, previewAttack } from './battle';
import { enterKeruEncounter, tapInKeru } from './keruLeadership';
import { partyDamageTarget, partyDamageTargets } from './partyDamage';
import { intentPassiveAndFire } from './battleDeadRun';
import { DEEP_BREATH } from './battleTutorialScenarios';

const ready=()=>{const s=createCombatSandboxScenario('1002');return {...s,party:s.party.map(a=>({...a,charge:6,...(a.id==='aldan-seed'?{hp:30,tempHp:2}:a.id==='hero'?{hp:9}: {})}))};};
describe('Seed protection of the active leader',()=>{
 it('redirects a leader-targeted hit, preview and event to the Seed and uses its shield',()=>{
  const s=ready(),attack=actorAttack(s,'hero')!;expect(attack.damage).toBeGreaterThan(0);
  const next=applyAttack(s,'hero','hero'),target=next.party.find(a=>a.id==='aldan-seed')!;
  expect(next.party.find(a=>a.id==='hero')!.hp).toBe(9);
  expect(target.hp).toBe(Math.max(0,30-Math.max(0,attack.damage-2)));
  expect(target.tempHp).toBe(Math.max(0,2-attack.damage));
  expect(target.charge).toBe(6-attack.charge);
  expect(next.events.filter(e=>e.kind==='hit').slice(-1)[0].targetId).toBe('aldan-seed');
  expect(previewAttack(s,'hero','hero')).toMatchObject({foeId:'aldan-seed',hp:{before:30,after:target.hp}});
 });
 it('moves protection with leadership, leaving the former leader vulnerable as a support',()=>{
  const s=tapInKeru({...ready(),columns:[[{id:'six',rank:6}]]},'mochi');expect(s.keruExpedition?.leader).toBe('mochi');
  expect(partyDamageTarget(s,'mochi')?.id).toBe('aldan-seed');expect(partyDamageTarget(s,'hero')?.id).toBe('hero');
  const oldHit=applyAttack(s,'mochi','hero');expect(oldHit.party.find(a=>a.id==='hero')!.hp).toBeLessThan(9);expect(oldHit.party.find(a=>a.id==='aldan-seed')!.hp).toBe(30);
  const newHit=applyAttack(s,'mochi','mochi');expect(newHit.party.find(a=>a.id==='mochi')!.hp).toBe(s.party.find(a=>a.id==='mochi')!.hp);
 });
 it('resolves a party-wide ability once per receiver and never harms the sheltered leader',()=>{
  const base=createCombatSandboxScenario('020');let s=enterKeruEncounter({...base,party:[{...newActor('aldan-seed'),hp:200,maxHp:200},...base.party,...(base.party.some(a=>a.id==='mochi')?[]:[newActor('mochi')])]});
  s={...s,tutorial:{...s.tutorial!,intent:{id:'ready',rank:7,pips:999,fired:0,cards:[]}}};
  const next=intentPassiveAndFire(s),beforeHero=s.party.find(a=>a.id==='hero')!;
  expect(next.party.find(a=>a.id==='hero')!.hp).toBe(beforeHero.hp);
  expect(next.party.find(a=>a.id==='aldan-seed')!.hp).toBe(200-DEEP_BREATH.damage);
  expect(next.party.find(a=>a.id==='mochi')!.hp).toBe(Math.max(0,s.party.find(a=>a.id==='mochi')!.hp-DEEP_BREATH.damage));
  expect(next.events.filter(e=>e.kind==='enemy-hit' && e.targetId==='aldan-seed')).toHaveLength(1);
 });
 it('preserves individual targeting in legacy battles without a Seed',()=>{
  const s=createCombatSandboxScenario('008');expect(partyDamageTarget(s,'hero')?.id).toBe('hero');expect(partyDamageTargets(s).map(a=>a.id)).toEqual(s.party.map(a=>a.id));
 });
});
