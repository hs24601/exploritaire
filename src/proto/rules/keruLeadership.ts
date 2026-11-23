import { newActor, type BattleState } from './battle';
import { isAdjacentRank } from './setup';
import { cardRanks } from './splitCards';

export const PERSONAL_VALUES = { hero:2, mochi:5, banks:9, cir:7, dem:1, riv:11 } as const;
export type LeaderKeruId = keyof typeof PERSONAL_VALUES;
/** Seed expeditions expose active abilities only from the current leader. */
export const canUseKeruAbilities = (state: BattleState, id: string): boolean => {
 if(!state.keruExpedition || id==='team' || id==='aldan-seed')return true;
 if(state.keruExpedition.leader!==id)return false;
 const actor=state.party.find(actor=>actor.id===id) ?? (id==='cir'?state.cirCompanion?.actor:undefined);
 return Boolean(actor && actor.hp>0 && !actor.disarmed && !actor.turnSpent);
};
/** Leadership spends the existing Seed bank; swapping never transfers AP. */
export const abilityBankId = (state: BattleState, id: string): string =>
 state.keruExpedition?.leader === id && state.party.some(actor => actor.id === 'aldan-seed') ? 'aldan-seed' : id;
/** Expedition/save data. Turn allowances and card piles deliberately stay encounter-local. */
export type KeruExpedition = { leader: LeaderKeruId; values: Record<LeaderKeruId,number> };
export const COLLECTED_LEADERS: readonly LeaderKeruId[] = ['hero','cir','dem','riv','mochi','banks'];
export const initialKeruExpedition = (): KeruExpedition => ({leader:'hero',values:{...PERSONAL_VALUES}});
const validRank = (n: unknown): n is number => typeof n==='number' && Number.isInteger(n) && n>=1 && n<=13;
export function normalizeKeruExpedition(saved?: KeruExpedition): KeruExpedition {
 const base=initialKeruExpedition();
 for(const id of Object.keys(PERSONAL_VALUES) as LeaderKeruId[])if(validRank(saved?.values?.[id]))base.values[id]=saved!.values[id];
 if(saved && COLLECTED_LEADERS.includes(saved.leader))base.leader=saved.leader;
 return base;
}
/** Begin a Seed encounter with carried values; combatsbx intentionally supplies no save. */
export function enterKeruEncounter(state: BattleState, saved?: KeruExpedition): BattleState {
 if(!state.party.some(a=>a.id==='aldan-seed'))return state;
 const expedition=normalizeKeruExpedition(saved),rank=expedition.values[expedition.leader];
 const party=state.party.some(a=>a.id===expedition.leader)?state.party:[...state.party,{...newActor(expedition.leader),rank:0,foundationCards:[]}];
 return {...state,keruExpedition:expedition,keruTapInUsed:false,keruLeaderStacks:{},party:party.map(a=>a.id==='aldan-seed'?{...a,rank,foundationCards:[{id:`leader-value-${expedition.leader}`,rank}]}:a)};
}
/** Copy this into the expedition save at the encounter boundary; never mutate the incoming save. */
export function keruExpeditionSnapshot(state: BattleState): KeruExpedition | undefined {
 if(!state.keruExpedition)return undefined;
 const saved=normalizeKeruExpedition(state.keruExpedition),seed=state.party.find(a=>a.id==='aldan-seed');
 if(seed && validRank(seed.rank))saved.values[saved.leader]=seed.rank;
 return saved;
}
export const personalValue = (state: BattleState,id: LeaderKeruId) => keruExpeditionSnapshot(state)?.values[id] ?? PERSONAL_VALUES[id];
export function tapInReason(state: BattleState,id: LeaderKeruId): string | null {
 if(!state.keruExpedition || !state.party.some(a=>a.id==='aldan-seed' && a.hp>0))return 'No active Seed expedition';
 if(state.result || state.turn==='enemy')return 'Party turn required';
 if(!COLLECTED_LEADERS.includes(id))return 'Not collected';
 if(state.keruExpedition.leader===id)return 'Current leader';
 if(state.keruTapInUsed)return 'Tap-in used this turn';
 const actor=state.party.find(a=>a.id===id) ?? (id==='cir'?state.cirCompanion?.actor:undefined) ?? (id==='dem'||id==='riv'?state.keruSelection?.reserves[id]:undefined);
 if(actor && (actor.hp<=0 || actor.disarmed || actor.turnSpent))return 'Keru unavailable';
 if(id==='cir' && (state.cirCompanion && (state.cirCompanion.form!=='available' || (state.cirCompanion.cooldown ?? 0)>0)))return 'Cir is committed or recovering';
 const value=personalValue(state,id);
 return state.columns.slice(0,state.rules.columns ?? state.columns.length).some(column=>{const card=column[column.length-1];return card && cardRanks(card).some(rank=>isAdjacentRank(value,rank));})?null:'Needs an exposed ±1 card';
}
export const canTapIn = (state: BattleState,id: LeaderKeruId) => tapInReason(state,id)===null;
/** Swap the single receiver's leader/value. No receipt, AP, healing or card consumption. */
export function tapInKeru(state: BattleState,id: LeaderKeruId): BattleState {
 if(!canTapIn(state,id))return state;
 const expedition=keruExpeditionSnapshot(state)!,seed=state.party.find(a=>a.id==='aldan-seed')!;
 const stacks={...state.keruLeaderStacks,[expedition.leader]:seed.foundationCards ?? []};
 const party=state.party.some(a=>a.id===id)?state.party:[...state.party,{...(id==='cir' && state.cirCompanion?state.cirCompanion.actor:newActor(id)),rank:0,foundationCards:[],targetId:seed.targetId}];
 return {...state,keruExpedition:{...expedition,leader:id},keruTapInUsed:true,keruLeaderStacks:stacks,party:party.map(a=>a.id==='aldan-seed'?{...a,rank:expedition.values[id],foundationCards:stacks[id] ?? [{id:`leader-value-${id}`,rank:expedition.values[id]}]}:a)};
}
export const leaderForCard = (id:string): LeaderKeruId | undefined => id==='summon-cir'?'cir':id==='hold'?'dem':id==='summon-riv'?'riv':undefined;
