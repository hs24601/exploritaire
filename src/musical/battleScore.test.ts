import {describe,it,expect} from 'vitest';
import {tableauMusicSeed,battleMusicIntensity,newMusicDeal} from './battleScore';
import type {BattleState} from '../proto/rules/battle';
const state=(hp=32)=>({started:true,result:null,time:1,sandboxScenario:'100',columns:[[{rank:2}],[{rank:7}]],party:[{id:'hero',hp,maxHp:32}],turn:'party',momentum:{value:0}} as BattleState);
describe('battle score adapter',()=>{
 it('uses only the positional first row',()=>{expect(tableauMusicSeed([[{rank:2},{rank:13}],[],[{rank:7,suit:'leaf'}]])).toBe('row1:2|_|7:leaf');});
 it('adds pressure with low health, momentum and enemy turns; ends quietly',()=>{const b=state();expect(battleMusicIntensity(state(4))).toBeGreaterThan(battleMusicIntensity(b));expect(battleMusicIntensity({...b,turn:'enemy'})).toBeGreaterThan(battleMusicIntensity(b));expect(battleMusicIntensity({...b,result:'won'})).toBe(0);expect(battleMusicIntensity({...b,started:false})).toBe(0);});
 it('holds theme identity during plays and resets on new encounter/restart',()=>{const b=state();expect(newMusicDeal(b,{...b,columns:[]})).toBe(false);expect(newMusicDeal(b,{...b,time:0})).toBe(true);expect(newMusicDeal(b,{...b,sandboxScenario:'101'})).toBe(true);});
});
