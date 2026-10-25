import {it,expect} from 'vitest';
import {createCombatSandboxScenario,useMomentumSkill,canUseMomentumSkill,MOMENTUM_SKILLS} from './battle';
it('offers free Withdraw in every sandbox and preserves full redeal and turn handoff',()=>{
 for(const id of ['001','002','003','004','005'] as const){const s=createCombatSandboxScenario(id);expect(MOMENTUM_SKILLS.withdraw.cost).toBe(0);expect(canUseMomentumSkill(s,'withdraw','tableau')).toBe(true);const n=useMomentumSkill(s,'withdraw','tableau');expect(n.columns).not.toEqual(s.columns);expect(n.round).toBe(2);expect(n.momentum?.value).toBe(0);expect(n.foes[0].hp).toBe(s.foes[0].hp);expect(n.reposition?.by).toBe('party');expect(useMomentumSkill(s,'withdraw',s.foes[0].id)).toBe(s);expect(canUseMomentumSkill({...s,turn:'enemy'},'withdraw')).toBe(false);}
});

it('Withdraw row destinations keep the selected row exposed, backfill behind it and hand off the turn',()=>{
 for(const row of [0,1,2,3]){
  const s=createCombatSandboxScenario('999');
  const n=useMomentumSkill(s,'withdraw','withdraw-row:'+row);
  expect(n.turn).toBe('enemy');expect(n.columns).toHaveLength(7);
  for(const [index,column] of n.columns.entries()){
   expect(column).toHaveLength(4);
   expect(column[column.length-1]).toEqual(s.columns[index][3-row]);
   expect(column.slice(row)).toEqual(s.columns[index].slice(0,4-row));
  }
  expect(n.reposition?.removedIds).toHaveLength(row*7);expect(n.reposition?.addedIds).toHaveLength(row*7);
  expect(n.party).toEqual(s.party);expect(n.momentum?.value).toBe(s.momentum?.value);expect(n.foes[0].hp).toBe(999);
 }
});
it('Withdraw rejects missing, invalid and non-row destinations without spending the turn',()=>{
 const s=createCombatSandboxScenario('999');
 for(const target of ['withdraw-row:-1','withdraw-row:4','withdraw-row:1.5','withdraw-row:NaN']){
  expect(canUseMomentumSkill(s,'withdraw',target)).toBe(false);expect(useMomentumSkill(s,'withdraw',target)).toBe(s);
 }
});
