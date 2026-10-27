import {describe,expect,it} from 'vitest';
import {actorAttack,applyAttack,applyTrap,createBattle,playCard,previewAttack,previewTrap,setMaxAP,setMochi,type BattleState} from './battle';
import {combatMovesFor} from './battleAbilities';
const base=()=>createBattle({tableau:[[{id:'three',rank:3}]],stock:[]});
describe('maxAP debug override',()=>{
 it('defaults off and enables every player ability at zero banked AP',()=>{
  let s=base();expect(s.maxAP).toBe(false);expect(actorAttack(s,'hero:Bite')).toBeNull();
  s=setMaxAP(s,true);
  for(const actor of s.party)for(const move of combatMovesFor(actor.id)){
   const key=actor.id+':'+move.name+(move.name==='Vice Grip'?':3':'');
   expect(actorAttack(s,key)).not.toBeNull();expect(previewAttack(s,key,'dark-slime')).not.toBeNull();
  }
  expect(s.started).toBe(false);expect(s.party.every(a=>a.charge===0)).toBe(true);
 });
 it('repeats attacks without spending banked AP or altering foundation cards/ranks',()=>{
  let s=setMaxAP(base(),true);s={...s,foes:s.foes.map(f=>({...f,hp:1000}))};const columns=s.columns;
  for(let n=0;n<20;n++)for(const actor of s.party)s=applyAttack(s,actor.id+':'+(actor.id==='hero'?'Bite':'Lacerate'),'dark-slime');
  expect(s.party.every(a=>a.charge===0&&a.count===0)).toBe(true);expect(s.party.map(a=>a.rank)).toEqual([2,5]);expect(s.columns).toBe(columns);
 });
 it('restores the earned finite bank when disabled and charges normal costs',()=>{
  let s=setMaxAP(base(),true);s=playCard(s,0,'hero');s=applyAttack(s,'hero:Bite','dark-slime');expect(s.party[0].charge).toBe(1);
  s=setMaxAP(s,false);expect(actorAttack(s,'hero:Bite')).toBeNull();s=applyAttack(s,'hero:Nip','dark-slime');expect(s.party[0].charge).toBe(0);
 });
 it('bypasses trap costs and keeps hold commitment finite and selectable',()=>{
  let s=setMaxAP(base(),true);s={...s,rules:{hungry:true,traps:true}};
  expect(previewTrap(s,'mochi:Lacerate',0)).not.toBeNull();s=applyTrap(s,'mochi:Lacerate',0);expect(s.party[1].charge).toBe(0);expect(s.traps.three).toBeDefined();
  const hold=actorAttack(s,'hero:Vice Grip:100')!;expect(hold.charge).toBe(100);expect(Number.isFinite(hold.effects[0].seconds)).toBe(true);
  expect(actorAttack(s,'hero:Vice Grip:Infinity')).toBeNull();
 });
 it('applies to newly added actors but never revives down actors or attacks after a result',()=>{
  let s=setMaxAP(base(),true);s=setMochi(setMochi(s,false),true);expect(actorAttack(s,'mochi:Lacerate')).not.toBeNull();
  s={...s,party:s.party.map(a=>({...a,hp:0}))};expect(actorAttack(s,'hero:Bite')).toBeNull();expect(applyAttack(s,'hero:Bite','dark-slime')).toBe(s);
  const won:BattleState={...setMaxAP(base(),true),result:'won'};expect(applyAttack(won,'hero:Bite','dark-slime')).toBe(won);
 });
});
