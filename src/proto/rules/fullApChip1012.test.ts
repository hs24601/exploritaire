import { expect, it } from 'vitest';
import { createCombatSandboxScenario, receiveCard, defaultStrike, apCap } from './battle';

it('doubles Hero chip damage on the receipt that reaches her current AP cap', () => {
 const base=createCombatSandboxScenario('1012');
 const hero=base.party.find(a=>a.id==='hero')!;
 const hit=(charge:number) => { const state={...base,party:base.party.map(a=>a.id==='hero'?{...a,charge}:a)}; return receiveCard(state,'hero',{card:{id:'test-receipt',rank:3},columns:state.columns,stock:state.stock,dealt:state.dealt}); };
 expect(base.foes[0].hp-hit(apCap(hero)-2).foes[0].hp).toBe(1);
 expect(base.foes[0].hp-hit(apCap(hero)-1).foes[0].hp).toBe(2);
 const full={...base,party:base.party.map(a=>a.id==='hero'?{...a,charge:apCap(a)}:a)};
 expect(base.foes[0].hp-defaultStrike(full,'hero',{name:'Test ability',damage:1,stagger:0}).foes[0].hp).toBe(1);
});
