import {describe,it,expect} from 'vitest';
import {createCombatSandboxScenario,canUseMomentumSkill,useMomentumSkill,tickBattle,eligibleActors} from './battle';
import type { BattleState } from './battle';
const base=()=>{const s=createCombatSandboxScenario('005');return {...s,momentum:{...s.momentum!,value:20,earned:20,sequence:4,decayEnabled:true},party:s.party.map(a=>({...a,charge:6}))};};
const ap=(s:BattleState,id:string)=>s.party.find(a=>a.id===id)!.charge;
describe('Momentum skill testbed',()=>{
 it('casts on the dropped enemy atomically and does not spend or retarget an invalid drop',()=>{
  const s=base(),other={...s.foes[0],id:'other',stagger:0};s.foes=[...s.foes,other];
  const n=useMomentumSkill(s,'bash','other');expect(n.foes[0].stagger).toBe(0);expect(n.foes[1].stagger).toBe(2);
  expect(n.party[0].targetId).toBe('other');expect(ap(n,'hero')).toBe(5);expect(n.momentum?.value).toBe(20);
  expect(useMomentumSkill(s,'bash','missing')).toBe(s);
  const broke={...s,party:s.party.map(a=>({...a,charge:0}))};expect(useMomentumSkill(broke,'bash','other')).toBe(broke);
 });
 it('starts with a distinct branching deal and both player foundations usable',()=>{const s=createCombatSandboxScenario('005');expect(s.foes[0]).toMatchObject({hp:24,ironbark:true,intent:'idle'});expect(s.columns).not.toEqual(createCombatSandboxScenario('004').columns);for(const id of ['hero','mochi'])expect(s.columns.some(c=>eligibleActors(s,c[c.length-1]).some(a=>a.id===id))).toBe(true);expect(canUseMomentumSkill(s,'bash')).toBe(false);});
 it('Bash spends one Hero AP, adds two stagger without spilling or generating Momentum or changing ranks',()=>{let s=base();s={...s,foes:s.foes.map(f=>({...f,stagger:4}))};const n=useMomentumSkill(s,'bash');expect(n.foes[0]).toMatchObject({hp:24,staggerStage:1});expect(n.foes[0].staggered).toBeGreaterThan(0);expect(n.columns).toHaveLength(7);expect(n.party.map(a=>a.rank)).toEqual(s.party.map(a=>a.rank));expect(ap(n,'hero')).toBe(5);expect(n.momentum).toMatchObject({value:20,earned:20,spent:0,sequence:4});});
 it('Pounce respects Ironbark and deals exactly six while staggered, without extra stagger or receipts',()=>{const s=base(),blocked=useMomentumSkill(s,'pounce');expect(blocked.foes[0].hp).toBe(24);expect(ap(blocked,'mochi')).toBe(3);const exposed={...s,foes:s.foes.map(f=>({...f,staggered:20,staggerStage:3}))},n=useMomentumSkill(exposed,'pounce');expect(n.foes[0].hp).toBe(18);expect(n.columns).toBe(s.columns);expect(n.momentum).toMatchObject({earned:20,spent:0,sequence:4});});
 it('rejects unaffordable skills, wrong scenario/turn, downed actors, dead targets and completed battles',()=>{const s=base();for(const bad of [{...s,sandboxScenario:'004' as const},{...s,turn:'enemy' as const},{...s,result:'won' as const},{...s,party:s.party.map(a=>({...a,charge:0}))},{...s,party:s.party.map(a=>({...a,hp:0}))},{...s,foes:s.foes.map(f=>({...f,hp:0}))}])expect(useMomentumSkill(bad,'bash')).toBe(bad);});
 it('supports optional downstream decay-freeze modifiers without granting Momentum',()=>{const s={...base(),momentumSkillModifiers:{pounce:[{kind:'freeze-decay' as const,seconds:5}]}},n=useMomentumSkill(s,'pounce');expect(n.momentum).toMatchObject({value:20,earned:20,decayFrozenFor:5});const held=tickBattle(n,4);expect(held.momentum?.value).toBe(20);expect(tickBattle(held,2).momentum?.value).toBe(19.5);expect(useMomentumSkill(base(),'pounce').momentum?.decayFrozenFor).toBeUndefined();});
});
