import {createPlayableSandboxScenario,eligibleActors,playCard,type BattleState} from '../proto/rules/battle';
import type {SnowflakeReward} from '../proto/rules/snowflakeReward';
import {sixColumnWoodsBattle} from './worldTableauLayout';
import {assessSolverMove,type SolverOptions} from '../proto/tableauSolver';
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
/** Same bounded best-path assessment as combatsbx, with actual rule eligibility
 * at the root and canonical receipt validation again when a move is applied. */
export function assessWorldRailMove(state:BattleState,options:SolverOptions={}){
 if(state.result||state.turn!=='party')return;
 const rootMoves=state.columns.flatMap((_,column)=>worldRailReceivers(state,column).map(id=>({column,foundation:state.party.findIndex(a=>a.id===id)})));
 const assessment=assessSolverMove({columns:state.columns,stock:state.stock,foundations:state.party.map(a=>a.rank)},{...options,rootMoves});
 if(!assessment)return;
 const {column,foundation}=assessment.move,cards=state.columns[column],card=cards[cards.length-1];
 return {column,cardId:card.id,actorId:state.party[foundation].id,method:assessment.method};
}
