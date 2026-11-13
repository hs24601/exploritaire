import { expect, it } from 'vitest';
import { createPlayableSandboxScenario } from './battle';
import { dragonFoundationPlay } from './battleTutorials';
import { triggerPhoenix } from './phoenixReward';
import { themedReceipt } from './iceRewards';

it('revives before defeat, damages and stuns each enemy, and common breaks',()=>{
 let s=createPlayableSandboxScenario('101');
 s={...s,turn:'enemy',party:s.party.map(a=>({...a,hp:1,iceRewards:['heart-of-the-phoenix']})),rules:{...s.rules,finiteTableau:true},columns:s.columns.map((_,i)=>i===0?[{id:'hit',rank:10}]:[])};
 const next=dragonFoundationPlay(s,0)!;
 expect(next.party[0].hp).toBe(5);expect(next.party[0].phoenixRecharge).toBe(-1);
 expect(next.foes.map(f=>f.hp)).toEqual([8,8]);expect(next.foes.every(f=>f.statuses?.some(x=>x.id==='stun'))).toBe(true);
 expect(next.result).toBeNull();expect(dragonFoundationPlay(next,0)).toBeNull();
 expect(triggerPhoenix({...next,party:next.party.map(a=>({...a,hp:0}))}).party[0].hp).toBe(0);
});
it('recharges a rare Phoenix after the specified receipts',()=>{
 let s=createPlayableSandboxScenario('100');let hero={...s.party[0],hp:0,iceRewards:['heart-of-the-phoenix'] as const,iceRewardTiers:{'heart-of-the-phoenix':1} as const};
 let actor=triggerPhoenix({...s,party:[{...hero,iceRewards:[...hero.iceRewards]}]}).party[0];
 expect(actor.hp).toBe(8);expect(actor.phoenixRecharge).toBe(12);
 for(let i=0;i<12;i++)actor=themedReceipt(actor,6);
 expect(actor.phoenixRecharge).toBe(0);
});
