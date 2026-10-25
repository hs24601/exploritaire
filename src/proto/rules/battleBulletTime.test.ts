import {describe,it,expect} from 'vitest';
import {createCombatSandboxScenario,tickBattle,battleTimeScale} from './battle';
const base=()=>{const s=createCombatSandboxScenario('005');return {...s,momentum:{...s.momentum!,value:10,earned:10,rapidClock:0,recentPlays:[0],decayEnabled:true},foes:s.foes.map(f=>({...f,staggered:20}))};};
describe('stagger bullet time',()=>{
 it('slows all shared gameplay clock consumers by 90 percent without ticking untimed stagger',()=>{const s=base(),n=tickBattle(s,10);expect(battleTimeScale(s)).toBe(.1);expect(n.momentum).toMatchObject({value:9.5,rapidClock:1});expect(n.foes).toBe(s.foes);});
 it('slows modifiers as well as reserve decay and does not stack across enemies',()=>{let s=base();s={...s,momentum:{...s.momentum!,decayFrozenFor:5},foes:[...s.foes,{...s.foes[0],id:'second'}]};const n=tickBattle(s,20);expect(n.momentum).toMatchObject({value:10,decayFrozenFor:3,rapidClock:2});});
 it('stops slowing after recovery, death or battle completion; invalid ticks do nothing',()=>{const s=base();for(const foes of [s.foes.map(f=>({...f,staggered:0})),s.foes.map(f=>({...f,hp:0}))]){const n={...s,foes};expect(battleTimeScale(n)).toBe(1);expect(tickBattle(n,4).momentum?.value).toBe(8);}const won={...s,result:'won' as const};expect(battleTimeScale(won)).toBe(1);expect(tickBattle(won,100)).toBe(won);for(const dt of [NaN,Infinity,0,-1])expect(tickBattle(s,dt)).toBe(s);});
});
