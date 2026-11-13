import { LIGHT_MOTES, isLightMote } from './lightMoteData';
import type { RarityTier } from './keruInvokeData';
export const ICE_REWARDS = {
 ...LIGHT_MOTES,
 'ice-armor': { name:'Ice Armor', description:'At the end of your turn, gain 1 armor per unused AP, up to 5 armor.' },
 'rime-retort': { name:'Rime Retort', description:'Gain a stack when hit by chip damage or stagger. At 6 stacks, freeze the attacker for the rest of its turn, stopping its sequence.' },
 whiteout: { name:'Whiteout', description:'Chip hits have a 20% chance to add 1 ice damage and Frost for 2 turns. Each Frost on an enemy grants 10% evasion.' },
 'glacial-lance': { name:'Glacial Lance', description:'Spend 2 AP: deal 4 ice damage and apply 1 Frost.' },
 shatterstrike: { name:'Shatterstrike', description:'Consume 1 Frost on a chip hit for +3 ice and +1 stagger. Foe is easier to Frost for 2 turns.' },
 'snow-golem': { name:'Do you want to...?', description:'4 AP: summon a 20 HP Snow Golem. Later turns cost it 1 AP or 5 HP. It knows Glacial Lance.' },
 'ember-cadence': { name:'Incite', description:'', theme:'fire', effect:'burst' },
 'heart-of-the-phoenix': { name:'Heart of the Phoenix', description:'', theme:'fire' },
 'hearthguard': { name:'Hearthguard', description:'', theme:'fire', effect:'guard' },
 'thorns': { name:'Thorns', description:'', theme:'nature' },
 'regrowth': { name:'Regrowth', description:'', theme:'nature', effect:'heal' },
 'rootbridge': { name:'Rootbridge', description:'', theme:'nature', effect:'bridge' },
 'stone-shell': { name:'Fossilize', description:'', theme:'earth', effect:'guard' },
 'seismic-pulse': { name:'Seismic Pulse', description:'', theme:'earth', effect:'burst' },
 'flowing-current': { name:'Flowing Current', description:'', theme:'water', effect:'charge' },
 'tidal-step': { name:'Tidal Step', description:'', theme:'water', effect:'bridge' },
 'tailwind': { name:'Tailwind', description:'', theme:'air', effect:'charge' },
 'windstep': { name:'Windstep', description:'', theme:'air', effect:'bridge' },
 'static-burst': { name:'Static Burst', description:'', theme:'shock', effect:'burst' },
 'dynamo': { name:'Dynamo', description:'', theme:'shock', effect:'charge' },
 'dawnlight': { name:'Dawnlight', description:'', theme:'light', effect:'heal' },
 'radiant-pulse': { name:'Radiant Pulse', description:'', theme:'light', effect:'burst' },
 'siphon': { name:'Siphon', description:'', theme:'dark', effect:'heal' },
 'shadowstep': { name:'Shadowstep', description:'', theme:'dark', effect:'bridge' },
 'chaos-spark': { name:'Chaos Spark', description:'', theme:'chaos', effect:'burst' },
 'wildpath': { name:'Wildpath', description:'', theme:'chaos', effect:'bridge' },
 'steady-guard': { name:'Steady Guard', description:'', theme:'order', effect:'guard' },
 'measured-flow': { name:'Measured Flow', description:'', theme:'order', effect:'charge' },
 'cinder-road': { name:'Cinder Road', description:'', theme:'fire', effect:'bridge' },
 'bloomguard': { name:'Bloomguard', description:'', theme:'nature', effect:'guard' },
 'bedrock': { name:'Bedrock', description:'', theme:'earth', effect:'heal' },
 'rainward': { name:'Rainward', description:'', theme:'water', effect:'guard' },
 'gale-strike': { name:'Gale Strike', description:'', theme:'air', effect:'burst' },
 'stormward': { name:'Stormward', description:'', theme:'shock', effect:'guard' },
 'guiding-light': { name:'Guiding Light', description:'', theme:'light', effect:'bridge' },
 'night-strike': { name:'Night Strike', description:'', theme:'dark', effect:'burst' },
 'chaos-ward': { name:'Chaos Ward', description:'', theme:'chaos', effect:'guard' },
 'ordered-path': { name:'Ordered Path', description:'', theme:'order', effect:'bridge' },
} as const;
export type IceReward = keyof typeof ICE_REWARDS;
export type RewardTheme = 'ice' | 'fire' | 'nature' | 'earth' | 'water' | 'air' | 'shock' | 'light' | 'dark' | 'chaos' | 'order';
export const REWARD_THEMES: RewardTheme[] = ['ice','fire','nature','earth','water','air','shock','light','dark','chaos','order'];
export function rewardTheme(id:IceReward):RewardTheme { const def=ICE_REWARDS[id]; return 'theme' in def ? def.theme : 'ice'; }
export function rewardOwner(id: IceReward): 'Demi' | 'Dewi' | undefined {
 if (id==='ice-armor' || id==='rime-retort') return 'Demi';
 if (id==='whiteout' || id==='glacial-lance') return 'Dewi';
 return undefined;
}
export type IceRewardPick = { id: IceReward; tier: RarityTier };
export const ICE_RARITY_NAMES = ['Common','Rare','Epic','Legendary'] as const;
/** 60/25/12/3 base weights; guarantee one non-common when all three roll common. */
export function rollIceRewards(random:()=>number=Math.random,count=3,theme:RewardTheme | 'all'='ice'): IceRewardPick[] {
 const pool=(Object.keys(ICE_REWARDS) as IceReward[]).filter(id=>!isLightMote(id) && !['hearthguard','cinder-road','rootbridge','bloomguard','seismic-pulse','bedrock'].includes(id) && (theme==='all' || rewardTheme(id)===theme)),chosen:IceRewardPick[]=[];
 // Fill a short themed offer with distinct rewards from other available themes.
 const fallback=(Object.keys(ICE_REWARDS) as IceReward[]).filter(id=>!['hearthguard','cinder-road','rootbridge','bloomguard','seismic-pulse','bedrock'].includes(id) && !pool.includes(id));
 const limit=Math.min(Math.max(0,count),pool.length+fallback.length);
 for(let i=0;i<limit;i++){const source=pool.length ? pool : fallback;const index=Math.min(source.length-1,Math.floor(random()*source.length));const [id]=source.splice(index,1);const r=random();chosen.push({id,tier:r<.60?0:r<.85?1:r<.97?2:3});}
 if(chosen.length===3 && chosen.every(card=>card.tier===0)){const r=random();chosen[Math.min(chosen.length-1,Math.floor(random()*chosen.length))].tier=r<.625?1:r<.925?2:3;}
 return chosen;
}
export function iceTier(actor:{iceRewardTiers?:Partial<Record<IceReward,RarityTier>>},id:IceReward):RarityTier {return actor.iceRewardTiers?.[id] ?? 0;}
export function iceDescription(id:IceReward,tier:RarityTier):string {
 const def=ICE_REWARDS[id];
 if(id==='thorns') return `For the first 3 enemy turns each encounter, attackers take ${[1,2,3,4][tier]} damage per landed hit.`;
 if(id==='heart-of-the-phoenix') return `When Hero is downed, revive with ${[5,8,12,16][tier]} HP, deal ${[2,3,4,6][tier]} fire damage to all foes, and stun survivors for one enemy turn. ${tier===0?'Breaks permanently.':`Recharges after ${[0,12,8,5][tier]} Hero receipts.`}`;
 if(id==='ember-cadence') return `Each receipt builds Heat (cap ${tier===0?4:5}). At 2 Heat, chip hits deal +${tier>=2?2:1} damage. Heat resets at turn end${tier===3?', retaining 1':''}.`;
 if(id==='regrowth') return `Every 3 receipts, heal ${tier===0?'1':tier===1?'up to 2':tier===2?'up to 4':'up to 8'} HP; longer sequences in the same turn increase healing.`;
 if(id==='stone-shell') return `For the first ${tier===2?3:2} enemy turns each encounter, gain 1 armor per ${[3,2,2,1][tier]} HP lost, up to 8 armor. Partial damage carries over.`;
 if ('effect' in def) {
  const n=[4,3,2,2][tier], amount=tier===3?2:1;
  switch(def.effect) {
   case 'burst': return `Every ${n} receipts, deal +${amount} damage on the chip hit.`;
   case 'heal': return `Every ${n} receipts, heal ${amount} HP.`;
   case 'charge': return `Every ${n} receipts, gain ${amount} extra AP (up to the cap).`;
   case 'guard': return `At turn end, gain ${[1,2,3,4][tier]} armor, up to ${[5,8,12,12][tier]}.`;
   case 'bridge': return `Every ${n} receipts, your next card may match your foundation rank.`;
  }
 }
 switch(id){
 case 'ice-armor': return `Gain ${tier>=2?2:1} armor per unused AP at turn end, cap ${[5,8,12,12][tier]}.`+(tier===3?' Restore 1 after the first absorbed hit each enemy turn.':'');
 case 'rime-retort': return `After ${[6,5,4,4][tier]} received chip or stagger attacks, freeze the attacker for its turn.`+(tier===3?' Deal 2 ice damage to it.':'');
 case 'whiteout': return `${[20,30,40,40][tier]}% on chip hits: +${tier>=2?2:1} ice damage and ${tier===3?2:1} Frost for 2 turns. Each enemy Frost grants 10% evasion.`;
 case 'glacial-lance': return `2 AP: deal ${[4,6,8,8][tier]} ice damage and apply ${tier===3?2:1} Frost.`;
 case 'shatterstrike': return `Consume 1 Frost on a chip hit for +${[3,4,5,5][tier]} ice and +${tier>=2?2:1} stagger. Foe is easier to Frost for ${tier===3?3:2} turns.`;
 case 'snow-golem': return ICE_REWARDS[id].description+(tier>=1?' Rare+ also has Rime Retort.':'')+(tier===3?' Farewell: Nuclear Winter, 25 damage to all foes and 2 Frost to survivors.':'');
 default:return ICE_REWARDS[id].description;
 }
}
export function rewardHeal(hp:number,maxHp:number,amount:'five'|'half'|'full'):number {return Math.min(maxHp,amount==='full'?maxHp:hp+(amount==='five'?5:Math.ceil(maxHp/2)));}

/** Shared receipt effects for themed rewards. Count is incremented before the receipt resolves. */
export function themedChipBonus(actor:import('./battle').BattleActor):number {
 return (actor.iceRewards ?? []).reduce((sum,id)=>{if(id==='ember-cadence')return sum+((actor.inciteHeat ?? 0)>=2?(iceTier(actor,id)>=2?2:1):0);const d=ICE_REWARDS[id]; if(!('effect' in d) || d.effect!=='burst')return sum; const t=iceTier(actor,id); return sum+(actor.count>0 && actor.count%[4,3,2,2][t]===0?(t===3?2:1):0);},0);
}
export function themedReceipt(actor:import('./battle').BattleActor, cap:number):import('./battle').BattleActor {
 let next={...actor, rewardTurnMoves:(actor.rewardTurnMoves ?? 0)+1,...(actor.phoenixRecharge && actor.phoenixRecharge>0 ? {phoenixRecharge:actor.phoenixRecharge-1}:{})}; for(const id of actor.iceRewards ?? []) { if(id==='ember-cadence'){next={...next,inciteHeat:Math.min(iceTier(actor,id)===0?4:5,(next.inciteHeat ?? 0)+1)};continue;} if(id==='regrowth'){const progress=(actor.regrowthProgress ?? 0)+1, tier=iceTier(actor,id);const heal=progress>=3?Math.min([1,2,4,8][tier],2**Math.floor(((next.rewardTurnMoves ?? 1)-1)/3)):0;next={...next,regrowthProgress:progress%3,hp:Math.min(next.maxHp,next.hp+heal)};continue;} const d=ICE_REWARDS[id]; if(!('effect' in d))continue; const t=iceTier(actor,id); if(actor.count<=0 || actor.count%[4,3,2,2][t]!==0)continue; const amount=t===3?2:1;
 if(d.effect==='heal') next={...next,hp:Math.min(next.maxHp,next.hp+amount)};
 if(d.effect==='charge') next={...next,charge:Math.min(cap,next.charge+amount)};
 } return next;
}
export function themedGuard(actor:import('./battle').BattleActor):import('./battle').BattleActor {
 let next=actor; for(const id of actor.iceRewards ?? []) { if(id==='stone-shell')continue; const d=ICE_REWARDS[id]; if(!('effect' in d) || d.effect!=='guard')continue; const t=iceTier(actor,id); next={...next,iceArmor:Math.min([5,8,12,12][t],(next.iceArmor ?? 0)+[1,2,3,4][t])}; } return next;
}
export function themedBridge(actor:import('./battle').BattleActor, rank:number):boolean {
 return rank===actor.rank && (actor.iceRewards ?? []).some(id=>{const d=ICE_REWARDS[id];if(!('effect' in d) || d.effect!=='bridge')return false;const n=[4,3,2,2][iceTier(actor,id)];return actor.count>0 && actor.count%n===0;});
}
