import { describe, expect, it } from 'vitest';
import { canEndPlayerTurn, canPlay, canUseMomentumSkill, canWithdraw, createCombatSandboxScenario, decayMomentum, eligibleActors, endPlayerTurn, playCard, useMomentumSkill } from './battle';
import { nightAIStep, resolveGallowsBloom } from './nightRescue';

function opening(){
 let s=createCombatSandboxScenario('007');
 expect(s.columns).toHaveLength(7);
 expect(s.columns.every(c=>c.length===4)).toBe(true);
 for(let i=0;i<15;i++)s=playCard(s,s.columns.findIndex(c=>canPlay(s,'hero',c[c.length-1])),'hero');
 expect(s.night?.phase).toBe('desperation');
 expect(s.foes[0].hp).toBe(18);
 expect(s.momentum?.value).toBe(15);
 expect(s.columns).toHaveLength(7);
 expect(s.columns.every(c=>c.length===4)).toBe(true);
 return s;
}
describe('The Gallows Bloom',()=>{
 it('repeats the full deal while sending the opening route across irregular columns',()=>{
  let s=createCombatSandboxScenario('007');
  expect(s.columns).toEqual(createCombatSandboxScenario('007').columns);
  const visits:number[]=[];
  for(let i=0;i<15;i++){
   const column=s.columns.findIndex(c=>canPlay(s,'hero',c[c.length-1]));
   visits.push(column);s=playCard(s,column,'hero');
  }
  expect(new Set(visits).size).toBe(7);
  expect(visits.some((c,i)=>i>0&&c<visits[i-1])).toBe(true);
  expect(visits.some((c,i)=>i>0&&c>visits[i-1])).toBe(true);
 });
 it('allows early opening handoffs without losing the deterministic route',()=>{
  let s=createCombatSandboxScenario('007');
  for(let i=0;i<15;i++){
   expect(canEndPlayerTurn(s)).toBe(true);
   const before=s;
   s=endPlayerTurn(s);
   expect(s.round).toBe((before.round??1)+1);
   expect(s.turn).toBe('party');
   expect(s.columns).toBe(before.columns);
   expect(s.night?.phase).toBe('opening');
   s=playCard(s,s.columns.findIndex(c=>canPlay(s,'hero',c[c.length-1])),'hero');
  }
  expect(s.night?.phase).toBe('desperation');
  expect(s.foes[0].hp).toBe(18);
  expect(s.momentum?.value).toBe(15);
 });
 it('the announced deathblow kills the whole team without the veil',()=>{const s=resolveGallowsBloom(opening());expect(s.result).toBe('lost');expect(s.party.every(a=>a.hp===0)).toBe(true);});
 it('keeps a complete ability desperation turn, then a final countdown before Banks',()=>{
  let s=opening();
  expect(canWithdraw(s)).toBe(false);
  expect(eligibleActors(s,s.columns[0][0])).toEqual([]);
  expect(canUseMomentumSkill(s,'cir-meteor','khad-root')).toBe(false);
  const cards=s.foes[0].foundationCards;
  s=useMomentumSkill(s,'sticky-paws','mochi');
  s=useMomentumSkill(s,'pounce','khad-root');
  s=useMomentumSkill(s,'bash','khad-root');
  s=useMomentumSkill(s,'bash','khad-root');
  // Abilities cost each Kin's AP banked in the opening; shared Momentum is untouched for Banks.
  expect(s.momentum?.value).toBe(15);
  expect(s.foes[0].hp).toBe(18);
  expect(s.foes[0].stagger).toBe(0);
  expect(s.foes[0].foundationCards).toEqual(cards);
  expect(s.party.every(a=>a.rooted)).toBe(true);
  s=endPlayerTurn(s);
  expect(s.night?.phase).toBe('last-count');
  expect(s.foes[0].gallows).toBe(1);
  expect(s.party.some(a=>a.id==='banks')).toBe(false);
  s=endPlayerTurn(s);
  expect(s.night?.phase).toBe('entrance');
  expect(canEndPlayerTurn(s)).toBe(false);
 });
 it('funds rescue from zero Momentum, misses the wipe, swaps below threshold and breaks with a legal hit',()=>{
  let s=opening();
  s={...s,momentum:{...s.momentum!,value:0}};
  s=nightAIStep(endPlayerTurn(endPlayerTurn(s)));
  expect(s.party[0].id).toBe('banks');
  expect(s.party[0].rooted).toBe(true);
  expect(canPlay(s,'banks',s.columns[0][0])).toBe(false);
  expect(decayMomentum(s,100)).toBe(s);
  for(let i=0;i<10;i++){
   s=nightAIStep(s);
   if(i===0)expect(s.columns.some(c=>canPlay(s,'banks',c[c.length-1],true))).toBe(false);
   expect(s.party[0].stagger).toBeLessThan(9);
   expect(s.party.every(a=>a.hp>0)).toBe(true);
   expect(canPlay(s,'banks',s.columns[3][0])).toBe(false);
  }
  expect(s.foes[0].stagger).toBe(8);
  expect(s.party[0].stagger).toBe(0);
  expect(s.momentum?.value).toBe(0);
  expect(s.events.some(e=>e.label==='The Gallows Bloom · MISS')).toBe(true);
  expect(s.foes[0].rank).toBe(6);
  s=nightAIStep(s);
  expect(s.night?.phase).toBe('finish');
  expect(s.foes[0].staggered).toBeGreaterThan(0);
  expect(s.party.every(a=>!a.rooted)).toBe(true);
  expect(s.columns).toHaveLength(7);
  expect(s.columns.every(c=>c.length===4)).toBe(true);
  for(let i=0;i<9 && !s.result;i++)s=playCard(s,s.columns.findIndex(c=>canPlay(s,'hero',c[c.length-1])),'hero');
  expect(s.result).toBe('won');
 });
 it('all opening recipient choices reach the authored snare',()=>{
  let frontier=[createCombatSandboxScenario('007')];
  // Merge equivalent foundation states; both manual foundations start at two.
  for(let i=0;i<15;i++){
   const next=new Map<string,typeof frontier[number]>();
   for(const s of frontier){
    expect(s.columns.some(c=>eligibleActors(s,c[c.length-1]).length>0),JSON.stringify({i,r:s.party.map(a=>a.rank),c:s.columns.map(c=>c.map(c=>c.rank))})).toBe(true);
    for(let column=0;column<s.columns.length;column++)for(const actor of eligibleActors(s,s.columns[column][s.columns[column].length-1])){
    const n=playCard(s,column,actor.id);
    next.set(n.party.map(a=>a.rank).join(',')+n.foes[0].hp+':'+n.columns.map(c=>c.length).join(','),n);
   }
   }
   expect(next.size).toBeGreaterThan(0);frontier=[...next.values()];
  }
  for(const s of frontier){expect(s.night?.phase).toBe('desperation');expect(s.momentum?.value).toBe(15);}
 });
});
