import { canPlay, receiveCard, spendAP, type BattleState } from './battle';
import { isAdjacentRank } from './setup';
export function hasFrostRecipe(actor:BattleState['party'][number]) {return (actor.lightMotes?.['frost-mote']??0)>=2;}
export function iceClimb(state:BattleState,column:number):BattleState {
 const hero=state.party.find(a=>a.id==='hero'),pile=state.columns[column],index=(pile?.length??0)-2,card=pile?.[index];
 if(state.turn!=='party'||state.result||!hero||hero.hp<=0||!hasFrostRecipe(hero)||hero.count<(hero.iceClimberNext??0)||!card||!isAdjacentRank(hero.rank,card.rank)||!canPlay(state,'hero',card))return state;
 const next=receiveCard(state,'hero',{card,columns:state.columns.map((p,i)=>i===column?p.filter((_,j)=>j!==index):p),stock:state.stock,dealt:state.dealt});
 return {...next,party:next.party.map(a=>a.id==='hero'?{...a,iceClimberNext:a.count+10}:a)};
}
export function glacialArmor(state:BattleState):BattleState {
 const demi=state.party.find(a=>a.id==='dem');
 if(state.turn!=='party'||state.result||!demi||demi.hp<=0||!hasFrostRecipe(demi)||demi.charge<2)return state;
 const paid=spendAP(state,'dem',2);
 return {...paid,party:paid.party.map(a=>a.hp>0?{...a,iceArmor:Math.max(a.iceArmor??0,Math.min(6,(a.iceArmor??0)+3))}:a)};
}
