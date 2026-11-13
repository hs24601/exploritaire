import { actorAP, newActor, spendAP, drawCard, type BattleState } from './battle';
import { damageFoe, pushEvents } from './battleStatuses';
import { iceTier } from './iceRewards';

/** Rewards remain cards in Hero's loadout; playing one spends AP, not a tableau receipt. */
export function summonSnowGolem(state:BattleState):BattleState {
 const hero=state.party.find(a=>a.id==='hero');
 if(!hero?.iceRewards?.includes('snow-golem') || state.turn!=='party' || state.result || actorAP(state,'hero')<4 || state.party.some(a=>a.id==='snow-golem' && a.hp>0))return state;
 const tier=iceTier(hero,'snow-golem'),draw=drawCard(state),rank=draw.card.rank;
 const golem={...newActor('snow-golem'),rank,foundationCards:[draw.card],targetId:hero.targetId,iceRewards:tier>=1?['glacial-lance','rime-retort'] as const:['glacial-lance'] as const,iceRewardTiers:{'rime-retort':tier,'glacial-lance':tier},golemTier:tier,golemGrace:true};
 const paid=spendAP({...state,stock:draw.stock,dealt:draw.dealt},'hero',4);
 return {...paid,party:[...paid.party.filter(a=>a.id!=='snow-golem'),{...golem,iceRewards:[...golem.iceRewards]}]};
}
export function castGlacialLance(state:BattleState,actorId:string,targetId?:string):BattleState {
 const actor=state.party.find(a=>a.id===actorId && a.hp>0),foe=state.foes.find(f=>f.id===(targetId ?? actor?.targetId) && f.hp>0);
 if(!actor?.iceRewards?.includes('glacial-lance') || !foe || state.turn!=='party' || state.result || actorAP(state,actorId)<2)return state;
 const tier=iceTier(actor,'glacial-lance');
 let next=damageFoe(spendAP(state,actorId,2),foe.id,[4,6,8,8][tier],'Glacial Lance · Ice','hit',actorId);
 if(next.foes.some(f=>f.id===foe.id && f.hp>0))next={...next,foes:next.foes.map(f=>f.id===foe.id?{...f,iceFrost:[...(f.iceFrost ?? []),...Array((tier===3?2:1)+((f.iceVulnerable ?? 0)>0?1:0)).fill(2)]}:f)};
 return next;
}
/** Legendary golems fire once when they leave play; only survivors receive Frost. */
export function golemFarewell(state:BattleState):BattleState {
 const golem=state.party.find(a=>a.id==='snow-golem');
 if(!golem || golem.hp>0 || golem.golemFarewellFired || golem.golemTier!==3)return state;
 let next:BattleState={...state,party:state.party.map(a=>a.id===golem.id?{...a,golemFarewellFired:true}:a)};
 for(const foe of next.foes){if(foe.hp<=0)continue;next=damageFoe(next,foe.id,25,'Nuclear Winter','hit',golem.id);next={...next,foes:next.foes.map(f=>f.id===foe.id && f.hp>0?{...f,iceFrost:[...(f.iceFrost ?? []),2,2]}:f)};}
 return next;
}
export function golemUpkeep(state:BattleState):BattleState {
 const golem=state.party.find(a=>a.id==='snow-golem' && a.hp>0);
 if(!golem)return state;
 if(golem.golemGrace)return {...state,party:state.party.map(a=>a.id===golem.id?{...a,golemGrace:false}:a)};
 if(golem.charge>=1)return spendAP(state,golem.id,1);
 const hp=Math.max(0,golem.hp-5);
 let next:BattleState={...state,party:state.party.map(a=>a.id===golem.id?{...a,hp}:a)};
 next=pushEvents(next,[{kind:'enemy-hit',targetId:golem.id,amount:5,label:'Snow Golem · Unpaid upkeep'},...(hp===0?[{kind:'down' as const,targetId:golem.id}]:[])]);
 return golemFarewell(next);
}
