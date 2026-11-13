import { expect, it } from 'vitest';
import { createPlayableSandboxScenario } from './battle';
import { dragonFoundationPlay } from './battleTutorials';
it('Thorns retaliates against each enemy that lands a hit, then expires',()=>{
 let s=createPlayableSandboxScenario('101');
 s={...s,turn:'enemy',party:s.party.map(a=>({...a,iceRewards:['thorns'],thornsTurns:3})),rules:{...s.rules,finiteTableau:true},columns:s.columns.map((_,i)=>i===0?[{id:'first',rank:10}]:i===1?[{id:'second',rank:7}]:[])};
 const one=dragonFoundationPlay(s,0)!;expect(one.foes[0].hp).toBe(9);
 const two=dragonFoundationPlay(one,1)!;expect(two.foes[1].hp).toBe(9);
 const noThorns={...s,party:s.party.map(a=>({...a,thornsTurns:0}))};expect(dragonFoundationPlay(noThorns,0)!.foes[0].hp).toBe(10);
});
