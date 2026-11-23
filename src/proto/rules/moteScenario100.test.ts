import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, endPlayerTurn, tickBattle } from './battle';
import { tutorialStrike } from './battleTutorials';

it('copies 1012 and lets the ability-free Mote chip on its foundation turn', () => {
 let state=createPlayableSandboxScenario('100');
 expect(state.party.map(a=>a.id)).toEqual(['hero']);
 expect(state.columns).toHaveLength(8);
 expect(state.foes[0].name).toBe('Mote of Darkness');
 expect(state.foes[0].hp).toBe(10);
 expect(state.tutorial?.intent).toBeUndefined();
 expect(tutorialStrike(state,'hero').damage).toBe(1);
 const foe=state.foes[0];
 state={...state,rules:{...state.rules,finiteTableau:true},columns:state.columns.map((_,i)=>i===0?[{id:'mote-chip',rank:foe.rank+1}]:[])};
 const hp=state.party.reduce((sum,a)=>sum+a.hp,0);
 state=endPlayerTurn(state);
 for(let i=0;i<40 && state.turn==='enemy';i++) state=tickBattle(state,1);
 expect(state.turn).toBe('party');
 expect(state.party.reduce((sum,a)=>sum+a.hp,0)).toBe(hp-1);
 expect(state.foes[0].rank).toBe(foe.rank+1);
 expect(state.events.filter(e=>e.chipDamage && e.sourceId===foe.id)).toHaveLength(1);
 expect(state.tutorial?.intent).toBeUndefined();
});
