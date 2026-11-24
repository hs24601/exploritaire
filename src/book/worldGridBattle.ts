import {canPlay,receiveCard,canEndPlayerTurn,endPlayerTurn,type BattleState} from '../proto/rules/battle';
import type {GridCard} from './gridTableau.js';
/** The grid owns legality/backfill; combat owns receipt effects. Start/stock only set rank. */
export function receiveWorldGridCard(state:BattleState,card:GridCard,kind:'start'|'play'|'stock'):BattleState{
 if(state.turn!=='party'||state.result)return state;
 if(kind!=='play')return {...state,party:state.party.map(a=>a.id==='hero'?{...a,rank:card.rank}:a)};
 if(!canPlay(state,'hero',card))return state;
 return receiveCard(state,'hero',{card,columns:state.columns,stock:state.stock,dealt:state.dealt},{attacks:false});
}
/** Destination selection is immediate and costs the turn, without a tableau receipt. */
export function moveWorldGridFoundation(state:BattleState,card:GridCard):BattleState{
 if(!canEndPlayerTurn(state)||state.turn!=='party'||state.result)return state;
 return endPlayerTurn(receiveWorldGridCard(state,card,'start'));
}
