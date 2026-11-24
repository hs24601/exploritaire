import {it,expect} from 'vitest';
import {createRescueBattle,ambushHero,banksArrives,banksAutoStep,banksScratch,banksBite} from './banksRescue';
import {createDayTwoState,createDayThreeState,dayOnePlan,dayOneAllowsPlan} from '../dayScenarios';
import {arriveActorAtBiome} from '../biomeArrival';
import {applyFoundationPlay} from './play';
it('one real slime hit knocks Hero unconscious; Banks legally clears all fourteen cards and wins with Scratch and Bite',()=>{
 let b=ambushHero(createRescueBattle());expect(b.party[0].hp).toBe(0);expect(b.events.filter(e=>e.kind==='enemy-hit')).toHaveLength(1);expect(b.events.some(e=>e.kind==='down')).toBe(true);
 b=banksArrives(b);expect(b.result).toBeNull();expect(b.party[1].rank).toBe(9);
 for(let i=0;i<14;i++){const next=banksAutoStep(b);expect(next).not.toBe(b);b=next;}
 expect(b.columns.flat()).toHaveLength(0);expect(b.party[1].count).toBe(14);expect(b.party[1].charge).toBe(14);expect(b.party[0].hp).toBe(0);
 b=banksScratch(b);expect(b.foes[0].hp).toBe(22);expect(b.party[1].charge).toBe(12);
 b=banksBite(b);expect(b.result).toBe('won');expect(b.party[1].charge).toBe(8);expect(b.party[0].hp).toBe(0);
});
it('Day 02 offers one manaberry, then the woods mana play triggers the ambush; Day 03 starts at home with Banks',()=>{
 let s=createDayTwoState();expect(s.haul.mana).toBe(1);expect(dayOnePlan(s).arrival.biomeId).toBe(s.dayScenarioTiles?.patchId);expect(dayOneAllowsPlan(s,dayOnePlan(s))).toBe(true);
 s=arriveActorAtBiome(s,'hero','day-one-berries',{x:-48,y:48});for(let i=0;i<3;i++)s=applyFoundationPlay(s,{columnIndex:i,foundationIndex:0})!.state;
 expect(s.haul.mana).toBe(2);expect(s.tableau.flat()).toHaveLength(0);expect(dayOnePlan(s).arrival.biomeId).toBe(s.dayScenarioTiles?.woodsId);expect(dayOneAllowsPlan(s,dayOnePlan(s))).toBe(true);
 const woods=s.biomeTiles.find(tile=>tile.id===s.dayScenarioTiles?.woodsId)!;s=arriveActorAtBiome(s,'hero',woods.id,woods.position);for(let i=0;i<4;i++)s=applyFoundationPlay(s,{columnIndex:Math.min(i,2),foundationIndex:0})!.state;
 expect(s.dayTwoAmbush).toBe(true);expect(s.haul.mana).toBe(3);expect(dayOneAllowsPlan(s,dayOnePlan(s))).toBe(false);
 const home=createDayThreeState();expect(home.day).toBe(3);expect(home.worldActors.map(a=>a.id)).toEqual(['hero','banks']);expect(home.worldActors.every(a=>a.position.y>=96)).toBe(true);
});
