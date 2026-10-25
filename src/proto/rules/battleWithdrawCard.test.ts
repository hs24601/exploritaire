import {it,expect} from 'vitest';
import {createCombatSandboxScenario,useMomentumSkill,canUseMomentumSkill,MOMENTUM_SKILLS} from './battle';
it('offers free Withdraw in every sandbox and preserves full redeal and turn handoff',()=>{
 for(const id of ['001','002','003','004','005'] as const){const s=createCombatSandboxScenario(id);expect(MOMENTUM_SKILLS.withdraw.cost).toBe(0);expect(canUseMomentumSkill(s,'withdraw','tableau')).toBe(true);const n=useMomentumSkill(s,'withdraw','tableau');expect(n.columns).not.toEqual(s.columns);expect(n.round).toBe(2);expect(n.momentum?.value).toBe(0);expect(n.foes[0].hp).toBe(s.foes[0].hp);expect(n.reposition?.by).toBe('party');expect(useMomentumSkill(s,'withdraw',s.foes[0].id)).toBe(s);expect(canUseMomentumSkill({...s,turn:'enemy'},'withdraw')).toBe(false);}
});
