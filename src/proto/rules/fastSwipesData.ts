import type {RarityTier} from './keruInvokeData';
/** First-pass balance drafts, not a universal rarity multiplier. */
export const FAST_SWIPES_TIERS=[
 {tier:0,rarity:'common',name:'Common',cost:3,interval:5,damage:1,maxAP:1,procAP:0},
 {tier:1,rarity:'rare',name:'Rare',cost:3,interval:4,damage:1,maxAP:1,procAP:0},
 {tier:2,rarity:'epic',name:'Epic',cost:3,interval:3,damage:1,maxAP:1,procAP:0},
 {tier:3,rarity:'legendary',name:'Legendary',cost:3,interval:3,damage:1,maxAP:1,procAP:1},
] as const;
export const fastSwipesSpec=(tier?:number)=>FAST_SWIPES_TIERS[tier===1||tier===2||tier===3?tier:0];
export const fastSwipesDescription=(tier:RarityTier=0)=>{const s=fastSwipesSpec(tier);return `Mochi · ${s.name} · Draft. Costs ${s.cost} Momentum to summon once. Mochi gains a separate support foundation with +${s.maxAP} maximum AP and no tableau value. Every ${s.interval} legal tableau cards to the prime foundation deal ${s.damage} base chip damage to the prime leader’s current target.${s.procAP?' When that hit removes enemy HP, restore 1 Mochi AP up to her capacity.':''} No additional AP cost for passive hits.`;};


