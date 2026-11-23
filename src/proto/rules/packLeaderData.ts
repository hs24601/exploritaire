import type {RarityTier} from './keruInvokeData';
export type PackLeaderState={tier?:RarityTier;charges:number;recharge:number;interval?:number};
/** First-pass drafts: improve cadence, then add bounded Legendary storage. */
export const PACK_LEADER_TIERS=[
 {tier:0,name:'Common',rarity:'common',interval:3,maxCharges:1},
 {tier:1,name:'Rare',rarity:'rare',interval:2,maxCharges:1},
 {tier:2,name:'Epic',rarity:'epic',interval:1,maxCharges:1},
 {tier:3,name:'Legendary',rarity:'legendary',interval:1,maxCharges:2},
] as const;
export const packLeaderSpec=(state?:Partial<PackLeaderState>)=>{
 const tier=state?.tier,base=PACK_LEADER_TIERS[tier===1||tier===2||tier===3?tier:0];
 return {...base,interval:typeof state?.interval==='number'&&Number.isInteger(state.interval)?Math.max(1,Math.min(12,state.interval)):base.interval};
};
export const tickPackLeader=(effect:PackLeaderState):PackLeaderState=>{
 const spec=packLeaderSpec(effect);if(effect.charges>=spec.maxCharges)return effect;
 const remaining=Math.max(0,effect.recharge-1);if(remaining>0)return {...effect,recharge:remaining};
 const charges=Math.min(spec.maxCharges,effect.charges+1);return {...effect,charges,recharge:charges<spec.maxCharges?spec.interval:0};
};
export const spendPackLeader=(effect:PackLeaderState):PackLeaderState=>({...effect,charges:effect.charges-1,recharge:effect.recharge>0?effect.recharge:packLeaderSpec(effect).interval});
export const packLeaderDescription=(effect?:PackLeaderState)=>{
 const spec=packLeaderSpec(effect),status=(effect?.charges??0)>0?`Ready: ${effect!.charges} free promotion${effect!.charges===1?'':'s'}.`:`Ready in ${effect?.recharge??spec.interval} player turns.`;
 return `Pack Leader · ${spec.name} draft. Hero grants a free party-leader promotion to any eligible living member every ${spec.interval} player turns. Costs no AP or Momentum. ${status} Stores up to ${spec.maxCharges}. Normal 3-Momentum promotions remain available while recharging. Hero must be alive and able to use abilities. Progress carries into continued encounters.`;
};
