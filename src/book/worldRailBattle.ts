import {createPlayableSandboxScenario,eligibleActors,playCard,type BattleState} from '../proto/rules/battle';
import type {SnowflakeReward} from '../proto/rules/snowflakeReward';
import {sixColumnWoodsBattle} from './worldTableauLayout';
/** The world contains Hero; do not invent a second, unspawned party member. */
export function createWorldRailBattle(reward?:SnowflakeReward):BattleState{
 const opening=createPlayableSandboxScenario('100');
 return sixColumnWoodsBattle({...opening,started:true,foes:opening.foes.map(foe=>({...foe,name:'Khadroot'})),snowflakeReward:reward});
}
export function worldRailReceivers(state:BattleState,column:number){
 if(state.result||state.turn!=='party')return [];
 const cards=state.columns[column],card=cards?.[cards.length-1];return card?eligibleActors(state,card).map(actor=>actor.id):[];
}
export function receiveWorldRailCard(state:BattleState,column:number,cardId:string,actorId:string):BattleState{
 const cards=state.columns[column];if(cards?.[cards.length-1]?.id!==cardId||!worldRailReceivers(state,column).some(id=>id===actorId))return state;
 return playCard(state,column,actorId);
}
