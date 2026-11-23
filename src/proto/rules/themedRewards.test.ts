import { expect, it } from 'vitest';
import { createPlayableSandboxScenario, type BattleActor } from './battle';
import { absorbTempHp } from './cirCompanion';
import { carrySeriesParty } from './combatSeries';
import { iceDescription, REWARD_THEMES, rewardTheme, rollIceRewards, themedChipBonus, themedReceipt } from './iceRewards';

it('rolls available rewards only from the requested theme',()=>{
 for(const theme of REWARD_THEMES){const cards=rollIceRewards(()=>0,3,theme);expect(cards.length).toBeGreaterThan(0);expect(new Set(cards.map(card=>card.id)).size).toBe(cards.length);expect(cards.some(card=>rewardTheme(card.id)===theme)).toBe(true);expect(cards).toHaveLength(3);}
 for(const theme of ['fire','nature','earth'] as const) expect(rollIceRewards(()=>0,3,theme)).toHaveLength(3);
});
it('builds Incite heat and heals increasingly long Regrowth sequences',()=>{
 let actor={...createPlayableSandboxScenario('100').party[0],hp:10,iceRewards:['ember-cadence','regrowth'] as const,iceRewardTiers:{regrowth:3} as const};
 let a: BattleActor={...actor,iceRewards:[...actor.iceRewards]};
 a=themedReceipt(a,6);expect(themedChipBonus(a)).toBe(0);
 a=themedReceipt(a,6);expect(themedChipBonus(a)).toBe(1);
 a=themedReceipt(a,6);expect(a.hp).toBe(11);
 for(let i=0;i<3;i++)a=themedReceipt(a,6);expect(a.hp).toBe(13);
 expect(iceDescription('ember-cadence',0)).toContain('Heat');
});
it('Fossilize converts only HP lost after armor, accumulates fractions, and resets on encounter carry',()=>{
 const base=createPlayableSandboxScenario('100'), fresh=createPlayableSandboxScenario('101');
 let actor={...base.party[0],iceRewards:['stone-shell'] as const,fossilTurns:2,iceArmor:1};
 let a: BattleActor={...actor,iceRewards:[...actor.iceRewards]};
 a=absorbTempHp(a,3);expect(a.hp).toBe(actor.hp-2);expect(a.iceArmor).toBe(0);expect(a.fossilRemainder).toBe(2);
 a=absorbTempHp(a,1);expect(a.iceArmor).toBe(1);expect(a.fossilRemainder).toBe(0);
 const carried=carrySeriesParty({...base,party:[{...a,fossilTurns:0}]},fresh).party[0];expect(carried.fossilTurns).toBe(2);
});

it('resets Heat at the handoff and counts Fossilize enemy turns', async()=>{
 const {endPlayerTurn,tickBattle}=await import('./battle');
 let state=createPlayableSandboxScenario('100');
 state={...state,rules:{...state.rules,finiteTableau:true},columns:state.columns.map(()=>[]),party:state.party.map(a=>({...a,iceRewards:['ember-cadence','stone-shell'],inciteHeat:4,rewardTurnMoves:4,fossilTurns:2}))};
 state=endPlayerTurn(state);expect(state.party[0].inciteHeat).toBe(0);expect(state.party[0].rewardTurnMoves).toBe(0);
 for(let i=0;i<40 && state.turn==='enemy';i++)state=tickBattle(state,1);
 expect(state.party[0].fossilTurns).toBe(1);
});
