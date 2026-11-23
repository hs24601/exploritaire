import type {BattleState} from '../proto/rules/battle';
import {normalizeMusicSeed} from '../audio/battleComposer';

/** Top row is index zero of each column, left to right. No IDs, clocks or RNG
 * state enter the seed; empty slots retain their column position. */
export function tableauMusicSeed(columns:readonly (readonly {rank:number;suit?:unknown}[])[]){return 'row1:'+columns.map(column=>{const c=column[0];return c?normalizeMusicSeed(c.rank)+(typeof c.suit==='string'?':'+c.suit:''):'_';}).join('|');}
export function newMusicDeal(before:BattleState|null,after:BattleState){return !before||before.sandboxScenario!==after.sandboxScenario||after.time<before.time||!!before.result&&!after.result||before.started&&!after.started||!before.started&&!after.started&&tableauMusicSeed(before.columns)!==tableauMusicSeed(after.columns);}
export function battleMusicIntensity(battle:BattleState){
 if(!battle.started||battle.result)return 0;
 const hero=battle.party.find(a=>a.id==='hero'),hp=hero?hero.hp/Math.max(1,hero.maxHp):battle.party.reduce((s,a)=>s+a.hp,0)/Math.max(1,battle.party.reduce((s,a)=>s+a.maxHp,0));
 const pressure=Math.max(0,Math.min(1,(1-hp)/.75)),momentum=Math.min(1,Math.max(0,battle.momentum?.value??0)/10);
 return Math.min(1,.16+pressure*.55+momentum*.18+(battle.turn==='enemy'?.11:0));
}
