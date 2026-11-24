import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, defaultStrike, endPlayerTurn, tickBattle } from './battle';

it('gives frost sentries a small renewable armor pool that absorbs attacks', () => {
 let state=createPlayableSandboxScenario('102');
 expect(state.foes[0].frostKit).toBe('armor');
 state={...state,rules:{...state.rules,finiteTableau:true},columns:state.columns.map(()=>[])};
 state=endPlayerTurn(state);
 for(let i=0;i<40 && state.turn==='enemy';i++) state=tickBattle(state,1);
 expect(state.foes[0].frostArmor).toBe(2);
 const hp=state.foes[0].hp;
 state=defaultStrike(state,'hero');
 expect(state.foes[0].hp).toBe(hp);
 expect(state.foes[0].frostArmor).toBe(1);
});

it('rime retort spends one AP after six chip hits and resets', () => {
 let state=createPlayableSandboxScenario('104');
 state={...state,party:state.party.map(a=>({...a,charge:3})),foes:state.foes.map((f,i)=>i===0?{...f,frostHits:5}:f)};
 state=defaultStrike(state,'hero');
 expect(state.party[0].charge).toBe(2);
 expect(state.foes[0].frostHits).toBe(0);
});

it('gives the frost warden encounter independent enemies', () => {
 const state=createPlayableSandboxScenario('105');
 expect(state.foes.map(f=>f.frostKit)).toEqual(['armor','retort']);
 expect(state.foes.map(f=>f.id)).toEqual(['frost-warden','rime-wisp']);
});
