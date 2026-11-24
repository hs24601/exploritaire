import {apCap,advancePackLeaderTurn} from './battle';
import type { BattleState } from './battle';
import { COMBAT_SANDBOX_SCENARIOS, type CombatSandboxScenarioId } from './battleSandboxScenarios';

/** Only authored, consecutive three-digit 100-series encounters advance the run. */
export const isSeriesEncounter = (id?: string): boolean => Boolean(id && /^1\d\d$/.test(id));
export function nextSeriesEncounter(id: CombatSandboxScenarioId): CombatSandboxScenarioId | undefined {
 if (!isSeriesEncounter(id)) return undefined;
 const wanted=String(Number(id)+1);
 return COMBAT_SANDBOX_SCENARIOS.find(s=>s.id===wanted)?.id;
}

/** Rebuild the encounter, carrying player-owned state and retargeting its fresh enemies. */
export function carrySeriesParty(previous: BattleState, fresh: BattleState): BattleState {
 const target=fresh.foes.find(foe=>foe.hp>0)?.id;
 const party=previous.party.map(actor=>({...structuredClone(actor),...(actor.grit?{grit:{...structuredClone(actor.grit),turn:fresh.round??0,enemies:[]}}:{}),targetId:target,inciteHeat:0,rewardTurnMoves:0,...(previous.bite&&actor.id==='hero'&&!actor.packLeader?{packLeader:{tier:0 as const,charges:1,recharge:0}}:{}),...(previous.bite&&actor.id==='hero'&&actor.hp>0?{charge:Math.min(apCap(actor),actor.charge+1)}:{}),...(actor.iceRewards?.includes('thorns')?{thornsTurns:3}:{}),...(actor.iceRewards?.includes('stone-shell')?{fossilTurns:actor.iceRewardTiers?.['stone-shell']===2?3:2,fossilRemainder:0}:{})}));
 const next:BattleState={...fresh, party,gritExhausted:previous.gritExhausted, snowflakeReward:previous.snowflakeReward, ...(previous.fastSwipesTier!==undefined?{fastSwipesTier:previous.fastSwipesTier}:{}), ...(previous.bite?{bite:{...previous.bite}}:{}), momentum:previous.momentum ? structuredClone(previous.momentum) : fresh.momentum,
  keruInvoke:previous.keruInvoke && fresh.keruInvoke ? {...structuredClone(previous.keruInvoke),farewells:[]} : fresh.keruInvoke,
  cir:previous.cir ? structuredClone(previous.cir) : fresh.cir,
  cirCompanion:previous.cirCompanion ? structuredClone(previous.cirCompanion) : fresh.cirCompanion};
 return previous.bite?advancePackLeaderTurn(next):next;
}


