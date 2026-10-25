import { describe, it, expect } from 'vitest';
import { createCombatSandboxScenario, tickBattle, endPlayerTurn, defaultStrike, applyAttack, cirFireHit, previewAttack, type BattleState } from './battle';
import { damageFoe } from './battleStatuses';
const base=(stacks:number):BattleState=>{
 const s=createCombatSandboxScenario('999');
 return {...s,columns:[[{id:'blocked',rank:5}]],rules:{...s.rules,finiteTableau:true,infinifillRows:undefined},
  party:s.party.map(a=>({...a,hp:100,maxHp:100,charge:a.id==='mochi'?3:1})),
  foes:s.foes.map(f=>({...f,indominable:stacks,rest:0}))};
};
describe('Indominable',()=>{
 it('only hits above 25 stacks, for the excess above 25, once at the end of each enemy turn',()=>{
  for(const stacks of [0,25,26,30]){
   const s=base(stacks),n=tickBattle(endPlayerTurn(s),1);
   expect(n.turn).toBe('party');expect(n.foes[0].indominable).toBe(stacks);
   expect(n.party.map(a=>a.hp)).toEqual(stacks>25?[100-(stacks-25),100-(stacks-25)]:[100,100]);
   expect(n.events.filter(e=>e.label==='Indominable')).toHaveLength(stacks>25?2:0);
   expect(tickBattle(n,1).party).toEqual(n.party);
  }
 });
 it('waits for the last receipt and includes newly earned stacks in the hit',()=>{
  let s=base(24);s={...s,columns:[[{id:'second',rank:11},{id:'first',rank:10}]]};
  s=tickBattle(endPlayerTurn(s),1);expect(s.foes[0].indominable).toBe(25);expect(s.party[1].hp).toBe(100);
  s=tickBattle(s,1);expect(s.foes[0].indominable).toBe(26);expect(s.party[1].hp).toBe(100);
  s=tickBattle(s,1);expect(s.turn).toBe('party');expect(s.party[1].hp).toBe(99);
 });
 it('emits the attack and down events, clears downed AP, and finishes defeat',()=>{
  let s=base(26);s={...s,party:s.party.map(a=>({...a,hp:a.id==='mochi'?1:0}))};
  const n=tickBattle(endPlayerTurn(s),1);
  expect(n.result).toBe('lost');expect(n.party.every(a=>a.hp===0 && a.charge===0)).toBe(true);
  expect(n.events).toEqual(expect.arrayContaining([expect.objectContaining({kind:'enemy-hit',label:'Indominable',amount:1,targetId:'mochi'}),expect.objectContaining({kind:'down',targetId:'mochi'})]));
 });
 it('removes stacks for actual chip, direct ability, fire and status HP damage',()=>{
  const s={...base(40),maxAP:true};
  for(const next of [defaultStrike(s,'hero'),applyAttack(s,'hero:Nip','khad-root'),cirFireHit(s,'khad-root',8,'Meteor'),damageFoe(s,'khad-root',3,'Bleed','dot')]){
   const lost=s.foes[0].hp-next.foes[0].hp;expect(lost).toBeGreaterThan(0);expect(next.foes[0].indominable).toBe(40-lost);
  }
 });
 it('does not reduce for blocked damage or zero damage and clamps stacks at zero',()=>{
  const s=base(2),guarded={...s,foes:s.foes.map(f=>({...f,ironbark:true}))};
  expect(defaultStrike(guarded,'hero').foes[0].indominable).toBe(2);
  expect(defaultStrike(s,'hero',{damage:0,stagger:2,name:'Bash'}).foes[0].indominable).toBe(2);
  expect(cirFireHit(s,'khad-root',8,'Meteor').foes[0].indominable).toBe(0);
  const low={...base(40),foes:base(40).foes.map(f=>({...f,hp:2}))};
  expect(cirFireHit(low,'khad-root',8,'Meteor').foes[0].indominable).toBe(38);
 });
 it('HP damage can take stacks below the hit threshold, preventing the next turn-end hit',()=>{
  const s=cirFireHit(base(30),'khad-root',8,'Meteor');
  const n=tickBattle(endPlayerTurn(s),1);expect(n.foes[0].indominable).toBe(22);expect(n.party.map(a=>a.hp)).toEqual([100,100]);
 });
 it('resolves the passive at the end of skipped and rearm turns',()=>{
  const s=base(26);
  const stunned={...s,foes:s.foes.map(f=>({...f,staggered:20}))};
  expect(tickBattle(endPlayerTurn(stunned),10).party[1].hp).toBe(99);
  const rearm={...s,foes:s.foes.map(f=>({...f,disarmed:true,foundationCards:[]}))};
  expect(endPlayerTurn(rearm).party[1].hp).toBe(99);
 });
});

it('Indominable hits each living party member equally and skips downed members',()=>{
 let s=base(30);s={...s,party:[...s.party,{...s.party[0],id:'banks',name:'Banks',hp:0}]};
 const n=tickBattle(endPlayerTurn(s),1);expect(n.party.map(a=>a.hp)).toEqual([95,95,0]);
 expect(n.events.filter(e=>e.label==='Indominable').map(e=>e.targetId)).toEqual(['hero','mochi']);
});
it('one attack wave uses the same stacks for both targets before Hearthflame retaliation',()=>{
 const s={...base(26),cir:{status:'bound' as const,actorId:'hero' as const}};
 const n=tickBattle(endPlayerTurn(s),1);expect(n.party.map(a=>a.hp)).toEqual([99,99]);
 expect(n.foes[0].indominable).toBe(25);expect(n.foes[0].hp).toBe(998);
});
it('Indominable can down the full party in one wave and clears both AP banks',()=>{
 const s={...base(40),party:base(40).party.map(a=>({...a,hp:10}))};
 const n=tickBattle(endPlayerTurn(s),1);expect(n.result).toBe('lost');expect(n.party.every(a=>a.hp===0 && a.charge===0)).toBe(true);
});

it('Indominable blocks chip and ability stagger without clearing existing gauge progress',()=>{
 const s={...base(10),maxAP:true,foes:base(10).foes.map(f=>({...f,stagger:4}))};
 for(const n of [defaultStrike(s,'hero'),defaultStrike(s,'hero',{damage:0,stagger:8,name:'Bash'}),applyAttack(s,'hero:Takedown','khad-root')]){
  expect(n.foes[0].stagger).toBe(4);expect(n.foes[0].staggered).toBe(0);expect(n.events.some(e=>e.kind==='stagger')).toBe(false);
 }
 expect(previewAttack(s,'hero:Takedown','khad-root')?.staggers).toBe(false);
});
it('the hit removing the last stack stays protected and the following hit can stagger',()=>{
 let s={...base(1),foes:base(1).foes.map(f=>({...f,stagger:5}))};
 s=defaultStrike(s,'hero');expect(s.foes[0]).toMatchObject({indominable:0,stagger:5,staggered:0});
 s=defaultStrike(s,'hero');expect(s.foes[0].staggered).toBeGreaterThan(0);
});
